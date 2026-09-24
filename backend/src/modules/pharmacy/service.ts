import {
  getDatabaseClient,
  PrescriptionStatus,
  StockMovementType,
  DispenseStatus,
  AuditAction,
  EncounterType,
  ChargeStatus,
  AlertType,
  AlertSeverity
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';

const prisma = getDatabaseClient();

export class PharmacyService {
  async getPrescriptionQueue() {
    return prisma.prescription.findMany({
      where: {
        status: { in: [PrescriptionStatus.ACTIVE, PrescriptionStatus.PARTIALLY_DISPENSED] }
      },
      orderBy: { createdAt: 'asc' },
      include: {
        patient: { select: { id: true, patientCode: true, fullName: true, phone: true } },
        doctor: { include: { user: { select: { fullName: true } }, department: true } },
        items: {
          include: {
            medicine: {
              include: {
                batches: {
                  where: { expiryDate: { gt: new Date() }, currentStock: { gt: 0 } },
                  orderBy: { expiryDate: 'asc' }
                }
              }
            }
          }
        }
      }
    });
  }

  async dispense(data: any, pharmacistUserId: string) {
    const rx = await prisma.prescription.findUnique({
      where: { id: data.prescriptionId },
      include: {
        items: { include: { medicine: true } },
        doctor: true,
        patient: { include: { allergies: { where: { active: true } } } }
      }
    });

    if (!rx) throw new AppError('Prescription not found.', 404, 'NOT_FOUND');
    if (rx.status === PrescriptionStatus.CANCELLED || rx.status === PrescriptionStatus.DISPENSED) {
      throw new AppError(`Prescription cannot be dispensed. Current status: ${rx.status}`, 400, 'INVALID_RX_STATUS');
    }

    const count = await prisma.dispenseRecord.count();
    const dispenseCode = `DSP-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      let grandTotalPaise = 0;
      const createdDispenseItems: any[] = [];
      const lowStockAlerts: any[] = [];

      for (const reqItem of data.items) {
        const rxItem = rx.items.find((i) => i.id === reqItem.prescriptionItemId);
        if (!rxItem) {
          throw new AppError(`Prescription item ${reqItem.prescriptionItemId} does not belong to this prescription.`, 400, 'INVALID_ITEM');
        }

        const remainingToDispense = rxItem.quantity - rxItem.dispensedQuantity;
        if (reqItem.quantityToDispense > remainingToDispense) {
          throw new AppError(
            `Cannot dispense ${reqItem.quantityToDispense} units for ${rxItem.medicine.brandName}. Only ${remainingToDispense} units remaining.`,
            400,
            'OVER_DISPENSE'
          );
        }

        // Controlled drug check: requires valid doctor registration
        if (rxItem.medicine.isControlled && (!rx.doctor.registrationNumber || rx.doctor.registrationNumber.trim() === '')) {
          throw new AppError(
            `Controlled medicine '${rxItem.medicine.brandName}' cannot be dispensed without a verified doctor registration number.`,
            403,
            'CONTROLLED_MEDICINE_RESTRICTION'
          );
        }

        // FEFO (First Expired, First Out) batch selection
        const validBatches = await tx.medicineBatch.findMany({
          where: {
            medicineId: rxItem.medicineId,
            expiryDate: { gt: now },
            currentStock: { gt: 0 }
          },
          orderBy: { expiryDate: 'asc' }
        });

        const totalStockAvailable = validBatches.reduce((acc, b) => acc + b.currentStock, 0);
        if (totalStockAvailable < reqItem.quantityToDispense) {
          throw new AppError(
            `Insufficient unexpired stock for '${rxItem.medicine.brandName}'. Required: ${reqItem.quantityToDispense}, Available: ${totalStockAvailable}`,
            400,
            'INSUFFICIENT_STOCK'
          );
        }

        // Pick across batches using FEFO
        let neededQty = reqItem.quantityToDispense;

        for (const batch of validBatches) {
          if (neededQty <= 0) break;

          const qtyFromBatch = Math.min(batch.currentStock, neededQty);
          const newBatchStock = batch.currentStock - qtyFromBatch;

          // 1. Deduct stock atomically
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: { currentStock: newBatchStock }
          });

          // 2. Stock movement ledger
          await tx.stockMovement.create({
            data: {
              medicineId: rxItem.medicineId,
              batchId: batch.id,
              movementType: StockMovementType.DISPENSE,
              quantityChange: -qtyFromBatch,
              balanceAfter: newBatchStock,
              referenceType: 'DISPENSE',
              referenceId: dispenseCode,
              notes: `Dispensed to patient ${rx.patientId} under Rx #${rx.prescriptionCode}`,
              createdById: pharmacistUserId
            }
          });

          const itemTotalPaise = qtyFromBatch * batch.salePricePaise;
          grandTotalPaise += itemTotalPaise;

          createdDispenseItems.push({
            prescriptionItemId: rxItem.id,
            medicineId: rxItem.medicineId,
            batchId: batch.id,
            quantityDispensed: qtyFromBatch,
            unitPricePaise: batch.salePricePaise,
            totalAmountPaise: itemTotalPaise
          });

          neededQty -= qtyFromBatch;

          // Check if medicine stock went below reorder level
          if (newBatchStock <= rxItem.medicine.reorderLevel) {
            lowStockAlerts.push({
              medicineName: rxItem.medicine.brandName,
              remaining: newBatchStock,
              reorder: rxItem.medicine.reorderLevel
            });
          }
        }

        // 3. Update PrescriptionItem dispensed quantity
        await tx.prescriptionItem.update({
          where: { id: rxItem.id },
          data: {
            dispensedQuantity: rxItem.dispensedQuantity + reqItem.quantityToDispense
          }
        });
      }

      // 4. Create DispenseRecord with items
      const record = await tx.dispenseRecord.create({
        data: {
          dispenseCode,
          prescriptionId: rx.id,
          patientId: rx.patientId,
          pharmacistId: pharmacistUserId,
          status: DispenseStatus.COMPLETED,
          totalAmountPaise: grandTotalPaise,
          items: {
            create: createdDispenseItems
          }
        },
        include: { items: { include: { medicine: true, batch: true } } }
      });

      // 5. Update Prescription overall status
      const updatedRxItems = await tx.prescriptionItem.findMany({ where: { prescriptionId: rx.id } });
      const allFullyDispensed = updatedRxItems.every((i) => i.dispensedQuantity >= i.quantity);

      await tx.prescription.update({
        where: { id: rx.id },
        data: {
          status: allFullyDispensed ? PrescriptionStatus.DISPENSED : PrescriptionStatus.PARTIALLY_DISPENSED
        }
      });

      // 6. Create PendingCharge for Billing
      await tx.pendingCharge.create({
        data: {
          patientId: rx.patientId,
          encounterType: EncounterType.OPD,
          encounterId: rx.consultationId,
          description: `Pharmacy Dispense (#${dispenseCode}) - ${createdDispenseItems.length} items`,
          quantity: 1,
          unitPricePaise: grandTotalPaise,
          totalPaise: grandTotalPaise,
          status: ChargeStatus.PENDING,
          createdById: pharmacistUserId
        }
      });

      // 7. Trigger low stock alerts if any
      for (const al of lowStockAlerts) {
        await tx.adminAlert.create({
          data: {
            alertType: AlertType.LOW_STOCK,
            severity: AlertSeverity.MEDIUM,
            message: `Low stock alert: '${al.medicineName}' stock level is now ${al.remaining} (Reorder threshold: ${al.reorder}).`
          }
        });
      }

      await recordAuditEntry({
        userId: pharmacistUserId,
        patientId: rx.patientId,
        action: AuditAction.CREATE,
        resourceType: 'PHARMACY_DISPENSE',
        resourceId: record.id,
        metadata: { dispenseCode, totalAmountPaise: grandTotalPaise, itemsCount: createdDispenseItems.length }
      });

      return record;
    });
  }

  async recordGoodsReceipt(data: any, staffUserId: string) {
    const medicine = await prisma.medicine.findUnique({ where: { id: data.medicineId } });
    if (!medicine) throw new AppError('Medicine not found.', 404, 'NOT_FOUND');

    return prisma.$transaction(async (tx) => {
      // Find or create batch
      let batch = await tx.medicineBatch.findUnique({
        where: {
          medicineId_batchNumber: {
            medicineId: data.medicineId,
            batchNumber: data.batchNumber
          }
        }
      });

      if (batch) {
        const newStock = batch.currentStock + data.quantity;
        batch = await tx.medicineBatch.update({
          where: { id: batch.id },
          data: {
            currentStock: newStock,
            purchasePricePaise: data.purchasePricePaise,
            mrpPaise: data.mrpPaise,
            salePricePaise: data.salePricePaise,
            expiryDate: new Date(data.expiryDate)
          }
        });
      } else {
        batch = await tx.medicineBatch.create({
          data: {
            medicineId: data.medicineId,
            batchNumber: data.batchNumber,
            supplierId: data.supplierId,
            purchasePricePaise: data.purchasePricePaise,
            mrpPaise: data.mrpPaise,
            salePricePaise: data.salePricePaise,
            currentStock: data.quantity,
            expiryDate: new Date(data.expiryDate),
            barcode: data.barcode
          }
        });
      }

      // Ledger entry
      await tx.stockMovement.create({
        data: {
          medicineId: data.medicineId,
          batchId: batch.id,
          movementType: StockMovementType.GOODS_RECEIPT,
          quantityChange: data.quantity,
          balanceAfter: batch.currentStock,
          referenceType: 'GOODS_RECEIPT',
          referenceId: data.batchNumber,
          notes: `GRN received from supplier ${data.supplierId}`,
          createdById: staffUserId
        }
      });

      return batch;
    });
  }

  async adjustStock(data: any, staffUserId: string) {
    const batch = await prisma.medicineBatch.findUnique({ where: { id: data.batchId } });
    if (!batch) throw new AppError('Medicine batch not found.', 404, 'NOT_FOUND');

    const newStock = batch.currentStock + data.quantityChange;
    if (newStock < 0) {
      throw new AppError('Stock adjustment would cause negative inventory.', 400, 'STOCK_CANNOT_BE_NEGATIVE');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.medicineBatch.update({
        where: { id: batch.id },
        data: { currentStock: newStock }
      });

      await tx.stockMovement.create({
        data: {
          medicineId: batch.medicineId,
          batchId: batch.id,
          movementType: data.movementType as StockMovementType,
          quantityChange: data.quantityChange,
          balanceAfter: newStock,
          referenceType: 'MANUAL_ADJUSTMENT',
          notes: data.notes,
          createdById: staffUserId
        }
      });

      return updated;
    });
  }

  async listMedicines(query?: { search?: string; controlledOnly?: boolean }) {
    const where: any = { active: true };
    if (query?.controlledOnly) where.isControlled = true;
    if (query?.search) {
      where.OR = [
        { genericName: { contains: query.search, mode: 'insensitive' } },
        { brandName: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search.toUpperCase() } }
      ];
    }

    return prisma.medicine.findMany({
      where,
      orderBy: { brandName: 'asc' },
      include: {
        batches: {
          where: { currentStock: { gt: 0 } },
          orderBy: { expiryDate: 'asc' }
        }
      }
    });
  }

  async getInventoryAlerts() {
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const nearExpiryBatches = await prisma.medicineBatch.findMany({
      where: {
        expiryDate: { lte: thirtyDaysFromNow },
        currentStock: { gt: 0 }
      },
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' }
    });

    const lowStockMedicines = await prisma.medicine.findMany({
      where: { active: true },
      include: { batches: true }
    });

    const lowStockItems = lowStockMedicines
      .map((m) => {
        const totalStock = m.batches.reduce((sum, b) => sum + b.currentStock, 0);
        return {
          medicine: m,
          totalStock,
          reorderLevel: m.reorderLevel,
          isLow: totalStock <= m.reorderLevel
        };
      })
      .filter((m) => m.isLow);

    return {
      nearExpiryBatches,
      lowStockItems
    };
  }
}

export const pharmacyService = new PharmacyService();
