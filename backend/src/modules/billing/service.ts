import {
  getDatabaseClient,
  ChargeStatus,
  BillStatus,
  DiscountStatus,
  PaymentMethod,
  RefundStatus,
  ShiftStatus,
  AuditAction,
  AlertType,
  AlertSeverity
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';
import { razorpayService } from '../../lib/payments/razorpay';
import { generatePrintableHtml } from '../../lib/pdf';

const prisma = getDatabaseClient();

export class BillingService {
  async getPendingCharges(patientId: string) {
    return prisma.pendingCharge.findMany({
      where: { patientId, status: ChargeStatus.PENDING },
      orderBy: { createdAt: 'desc' }
    });
  }

  async generateBillFromCharges(data: any, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      // Find eligible pending charges
      const charges = await tx.pendingCharge.findMany({
        where: {
          id: { in: data.pendingChargeIds },
          patientId: data.patientId,
          status: ChargeStatus.PENDING
        }
      });

      if (charges.length === 0) {
        throw new AppError('No unbilled pending charges found for selected IDs.', 400, 'NO_CHARGES');
      }

      // Check for existing draft bill for this encounter
      let bill = await tx.bill.findFirst({
        where: {
          patientId: data.patientId,
          encounterType: data.encounterType,
          encounterId: data.encounterId,
          status: BillStatus.DRAFT
        },
        include: { items: true }
      });

      if (!bill) {
        const count = await tx.bill.count();
        const billNumber = `BIL-${new Date().getFullYear()}-${(count + 1001).toString()}`;

        bill = await tx.bill.create({
          data: {
            billNumber,
            patientId: data.patientId,
            encounterType: data.encounterType,
            encounterId: data.encounterId,
            status: BillStatus.DRAFT,
            subtotalPaise: 0,
            discountPaise: 0,
            taxPaise: 0,
            totalPaise: 0,
            paidPaise: 0,
            balancePaise: 0
          },
          include: { items: true }
        });
      }

      let additionalSubtotal = 0;
      for (const charge of charges) {
        const billItem = await tx.billItem.create({
          data: {
            billId: bill.id,
            description: charge.description,
            quantity: charge.quantity,
            unitPricePaise: charge.unitPricePaise,
            totalPaise: charge.totalPaise
          }
        });

        // Mark charge billed and link to bill item
        await tx.pendingCharge.update({
          where: { id: charge.id },
          data: {
            status: ChargeStatus.BILLED,
            billItemId: billItem.id
          }
        });

        additionalSubtotal += charge.totalPaise;
      }

      const newSubtotal = bill.subtotalPaise + additionalSubtotal;
      const newTotal = newSubtotal - bill.discountPaise + bill.taxPaise;
      const newBalance = newTotal - bill.paidPaise;

      const updatedBill = await tx.bill.update({
        where: { id: bill.id },
        data: {
          subtotalPaise: newSubtotal,
          totalPaise: newTotal,
          balancePaise: newBalance
        },
        include: { items: true }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'BILL_DRAFT',
        resourceId: bill.id,
        metadata: { billNumber: bill.billNumber, chargesCount: charges.length, subtotalPaise: newSubtotal }
      });

      return updatedBill;
    });
  }

  async applyDiscount(data: any, staffUserId: string) {
    const bill = await prisma.bill.findUnique({ where: { id: data.billId } });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');
    if (bill.status === BillStatus.FINALIZED) throw new AppError('Cannot discount finalized bill. Use credit note instead.', 400, 'BILL_LOCKED');

    // Auto-approval limit: 1000 INR (100,000 paise)
    const autoApproveLimitSetting = await prisma.systemSetting.findUnique({ where: { key: 'AUTO_DISCOUNT_LIMIT_PAISE' } });
    const autoApproveLimit = autoApproveLimitSetting ? parseInt(autoApproveLimitSetting.value, 10) : 100000;

    const isAutoApproved = data.amountPaise <= autoApproveLimit;

    return prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          billId: data.billId,
          amountPaise: data.amountPaise,
          reason: data.reason,
          status: isAutoApproved ? DiscountStatus.APPROVED : DiscountStatus.REQUESTED,
          requestedById: staffUserId,
          approvedById: isAutoApproved ? staffUserId : null
        }
      });

      if (isAutoApproved) {
        const newDiscountTotal = bill.discountPaise + data.amountPaise;
        const newTotal = Math.max(0, bill.subtotalPaise - newDiscountTotal + bill.taxPaise);
        const newBalance = Math.max(0, newTotal - bill.paidPaise);

        await tx.bill.update({
          where: { id: bill.id },
          data: {
            discountPaise: newDiscountTotal,
            totalPaise: newTotal,
            balancePaise: newBalance
          }
        });
      } else {
        // Trigger admin alert for high discount request
        await tx.adminAlert.create({
          data: {
            alertType: AlertType.HIGH_DISCOUNT,
            severity: AlertSeverity.MEDIUM,
            message: `High discount request: ₹${(data.amountPaise / 100).toFixed(2)} requested for Bill #${bill.billNumber}. Reason: ${data.reason}`,
            metadataJson: JSON.stringify({ discountId: discount.id, billId: bill.id, amountPaise: data.amountPaise })
          }
        });
      }

      await recordAuditEntry({
        userId: staffUserId,
        patientId: bill.patientId,
        action: AuditAction.CREATE,
        resourceType: 'DISCOUNT',
        resourceId: discount.id,
        metadata: { autoApproved: isAutoApproved, amountPaise: data.amountPaise }
      });

      return discount;
    });
  }

  async recordPayment(data: any, staffUserId: string) {
    // 1. Idempotency Check
    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: data.idempotencyKey }
    });
    if (existingPayment) {
      return { isDuplicate: true, payment: existingPayment };
    }

    const bill = await prisma.bill.findUnique({
      where: { id: data.billId },
      include: { payments: true }
    });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');

    // 2. Overpayment Protection
    if (data.amountPaise > bill.balancePaise) {
      throw new AppError(
        `Payment amount of ₹${(data.amountPaise / 100).toFixed(2)} exceeds remaining balance of ₹${(bill.balancePaise / 100).toFixed(2)}.`,
        400,
        'OVERPAYMENT_PROHIBITED'
      );
    }

    const count = await prisma.payment.count();
    const receiptNumber = `REC-${new Date().getFullYear()}-${(count + 5001).toString()}`;

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          receiptNumber,
          billId: data.billId,
          patientId: data.patientId,
          amountPaise: data.amountPaise,
          paymentMethod: data.paymentMethod,
          idempotencyKey: data.idempotencyKey,
          transactionReference: data.transactionReference,
          cashierShiftId: data.cashierShiftId,
          receivedById: staffUserId
        }
      });

      const newPaid = bill.paidPaise + data.amountPaise;
      const newBalance = bill.totalPaise - newPaid;

      // Update bill paid and balance
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidPaise: newPaid,
          balancePaise: newBalance,
          status: newBalance === 0 ? BillStatus.FINALIZED : bill.status,
          finalizedAt: newBalance === 0 ? new Date() : bill.finalizedAt,
          finalizedById: newBalance === 0 ? staffUserId : bill.finalizedById
        }
      });

      // If CashierShift is linked and method is CASH, update shift systemCashPaise
      if (data.cashierShiftId && data.paymentMethod === PaymentMethod.CASH) {
        await tx.cashierShift.update({
          where: { id: data.cashierShiftId },
          data: {
            systemCashPaise: { increment: data.amountPaise }
          }
        });
      }

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'PAYMENT',
        resourceId: payment.id,
        metadata: { receiptNumber, amountPaise: data.amountPaise, method: data.paymentMethod }
      });

      return { isDuplicate: false, payment };
    });
  }

  async createRazorpayOrder(billId: string, patientId: string) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');
    if (bill.balancePaise <= 0) throw new AppError('Bill has already been settled in full.', 400, 'BILL_SETTLED');

    // Amount always calculated from server database
    const order = await razorpayService.createOrder({
      amountPaise: bill.balancePaise,
      receipt: bill.billNumber
    });

    return {
      orderId: order.id,
      amountPaise: bill.balancePaise,
      currency: 'INR',
      keyId: razorpayService['keyId']
    };
  }

  async verifyAndRecordOnlinePayment(billId: string, patientId: string, paymentData: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const isValid = razorpayService.verifyPaymentSignature(
      paymentData.razorpayOrderId,
      paymentData.razorpayPaymentId,
      paymentData.razorpaySignature
    );

    if (!isValid) {
      throw new AppError('Razorpay payment signature verification failed.', 400, 'PAYMENT_SIGNATURE_INVALID');
    }

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');

    return this.recordPayment(
      {
        billId,
        patientId,
        amountPaise: bill.balancePaise,
        paymentMethod: PaymentMethod.RAZORPAY,
        idempotencyKey: `rzp_${paymentData.razorpayPaymentId}`,
        transactionReference: paymentData.razorpayPaymentId
      },
      'SYSTEM_GATEWAY'
    );
  }

  async finalizeBill(billId: string, staffUserId: string) {
    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: {
        status: BillStatus.FINALIZED,
        finalizedAt: new Date(),
        finalizedById: staffUserId
      }
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: bill.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'BILL_FINALIZE',
      resourceId: billId
    });

    return updated;
  }

  async createCreditNote(data: any, staffUserId: string) {
    const bill = await prisma.bill.findUnique({ where: { id: data.billId } });
    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');

    const count = await prisma.creditNote.count();
    const creditNoteNumber = `CN-${new Date().getFullYear()}-${(count + 1001).toString()}`;

    return prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          billId: data.billId,
          amountPaise: data.amountPaise,
          reason: data.reason,
          createdById: staffUserId
        }
      });

      const newBalance = Math.max(0, bill.balancePaise - data.amountPaise);
      await tx.bill.update({
        where: { id: bill.id },
        data: { balancePaise: newBalance }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: bill.patientId,
        action: AuditAction.CREATE,
        resourceType: 'CREDIT_NOTE',
        resourceId: cn.id,
        metadata: { creditNoteNumber, amountPaise: data.amountPaise }
      });

      return cn;
    });
  }

  async startCashierShift(cashierId: string, openingCashPaise: number) {
    const active = await prisma.cashierShift.findFirst({
      where: { cashierId, status: ShiftStatus.OPEN }
    });

    if (active) {
      throw new AppError('You already have an active open cashier shift.', 400, 'SHIFT_ALREADY_OPEN');
    }

    return prisma.cashierShift.create({
      data: {
        cashierId,
        openingCashPaise,
        systemCashPaise: 0,
        status: ShiftStatus.OPEN
      }
    });
  }

  async closeCashierShift(shiftId: string, closingCashPaise: number, notes?: string, cashierId?: string) {
    const shift = await prisma.cashierShift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.status !== ShiftStatus.OPEN) {
      throw new AppError('Shift not found or already closed.', 404, 'SHIFT_NOT_OPEN');
    }

    const expectedCash = shift.openingCashPaise + shift.systemCashPaise;
    const discrepancy = closingCashPaise - expectedCash;

    const closed = await prisma.cashierShift.update({
      where: { id: shiftId },
      data: {
        closingCashPaise,
        discrepancyPaise: discrepancy,
        status: ShiftStatus.CLOSED,
        endTime: new Date(),
        notes
      }
    });

    // Alert if discrepancy exists
    if (discrepancy !== 0) {
      await prisma.adminAlert.create({
        data: {
          alertType: AlertType.SHIFT_DISCREPANCY,
          severity: Math.abs(discrepancy) > 50000 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
          message: `Cashier Shift Discrepancy detected: ₹${(discrepancy / 100).toFixed(2)} variance on Shift #${shiftId}.`,
          metadataJson: JSON.stringify({ shiftId, expectedCash, closingCashPaise, discrepancy })
        }
      });
    }

    return closed;
  }

  async getPrintableReceipt(receiptId: string) {
    const payment = await prisma.payment.findUnique({
      where: { id: receiptId },
      include: {
        patient: true,
        bill: { include: { items: true } }
      }
    });

    if (!payment) throw new AppError('Payment receipt not found.', 404, 'NOT_FOUND');

    const html = generatePrintableHtml({
      hospitalName: 'CareSmart Multispeciality Hospital',
      documentTitle: `Payment Receipt (#${payment.receiptNumber})`,
      patientName: payment.patient.fullName,
      patientCode: payment.patient.patientCode,
      date: payment.receivedAt.toISOString().split('T')[0],
      items: [
        { label: 'Bill Number', value: payment.bill.billNumber },
        { label: 'Payment Method', value: payment.paymentMethod },
        { label: 'Transaction Ref', value: payment.transactionReference || 'N/A' },
        { label: 'Amount Paid', value: `₹${(payment.amountPaise / 100).toFixed(2)}` }
      ],
      tables: [
        {
          headers: ['Item Description', 'Qty', 'Rate', 'Total'],
          rows: payment.bill.items.map((i) => [
            i.description,
            i.quantity.toString(),
            `₹${(i.unitPricePaise / 100).toFixed(2)}`,
            `₹${(i.totalPaise / 100).toFixed(2)}`
          ])
        }
      ],
      notes: `Total Billed: ₹${(payment.bill.totalPaise / 100).toFixed(2)} | Paid to date: ₹${(payment.bill.paidPaise / 100).toFixed(2)} | Balance: ₹${(payment.bill.balancePaise / 100).toFixed(2)}`
    });

    return { html, receiptNumber: payment.receiptNumber };
  }

  async getPrintableBill(billId: string) {
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        patient: true,
        items: true,
        payments: true,
        discounts: { where: { status: DiscountStatus.APPROVED } }
      }
    });

    if (!bill) throw new AppError('Bill not found.', 404, 'NOT_FOUND');

    const html = generatePrintableHtml({
      hospitalName: 'CareSmart Multispeciality Hospital',
      documentTitle: `Detailed Tax Invoice (#${bill.billNumber})`,
      patientName: bill.patient.fullName,
      patientCode: bill.patient.patientCode,
      date: bill.createdAt.toISOString().split('T')[0],
      items: [
        { label: 'Status', value: bill.status },
        { label: 'Subtotal', value: `₹${(bill.subtotalPaise / 100).toFixed(2)}` },
        { label: 'Discounts', value: `₹${(bill.discountPaise / 100).toFixed(2)}` },
        { label: 'Net Total', value: `₹${(bill.totalPaise / 100).toFixed(2)}` },
        { label: 'Paid Amount', value: `₹${(bill.paidPaise / 100).toFixed(2)}` },
        { label: 'Balance Outstanding', value: `₹${(bill.balancePaise / 100).toFixed(2)}` }
      ],
      tables: [
        {
          headers: ['#', 'Particulars', 'Qty', 'Unit Rate', 'Amount'],
          rows: bill.items.map((item, idx) => [
            (idx + 1).toString(),
            item.description,
            item.quantity.toString(),
            `₹${(item.unitPricePaise / 100).toFixed(2)}`,
            `₹${(item.totalPaise / 100).toFixed(2)}`
          ])
        }
      ],
      notes: 'GSTIN: 36AAAAA0000A1Z5. Computer generated transparent hospital tax bill.'
    });

    return { html, billNumber: bill.billNumber };
  }

  async getPublicPriceList() {
    return prisma.servicePrice.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        category: true,
        name: true,
        pricePaise: true
      }
    });
  }
}

export const billingService = new BillingService();
