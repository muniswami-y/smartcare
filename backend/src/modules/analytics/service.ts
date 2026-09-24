import {
  getDatabaseClient,
  AppointmentStatus,
  AdmissionStatus,
  BillStatus,
  DiagnosticOrderStatus
} from '@caresmart/database';

const prisma = getDatabaseClient();

export class AnalyticsService {
  async getDashboardKpis() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

    const [
      totalPatients,
      todayAppointments,
      todayCompletedVisits,
      todayNoShows,
      admittedCount,
      totalBeds,
      totalRevenueAggregate,
      pendingRevenueAggregate,
      completedLabOrdersToday,
      historySnapshots
    ] = await Promise.all([
      prisma.patient.count({ where: { mergedIntoPatientId: null } }),
      prisma.appointment.count({
        where: { appointmentDate: { gte: todayStart, lte: todayEnd } }
      }),
      prisma.appointment.count({
        where: { appointmentDate: { gte: todayStart, lte: todayEnd }, status: AppointmentStatus.COMPLETED }
      }),
      prisma.appointment.count({
        where: { appointmentDate: { gte: todayStart, lte: todayEnd }, status: AppointmentStatus.NO_SHOW }
      }),
      prisma.admission.count({
        where: { status: AdmissionStatus.ADMITTED }
      }),
      prisma.bed.count({ where: { active: true } }),
      prisma.bill.aggregate({
        _sum: { paidPaise: true }
      }),
      prisma.bill.aggregate({
        where: { status: { in: [BillStatus.DRAFT, BillStatus.FINALIZED] } },
        _sum: { balancePaise: true }
      }),
      prisma.diagnosticOrder.count({
        where: {
          createdAt: { gte: todayStart, lte: todayEnd },
          status: DiagnosticOrderStatus.COMPLETED
        }
      }),
      prisma.dailySnapshot.findMany({
        orderBy: { snapshotDate: 'asc' },
        take: 30
      })
    ]);

    const bedOccupancyRatePct = totalBeds > 0 ? parseFloat(((admittedCount / totalBeds) * 100).toFixed(1)) : 0;
    const noShowRatePct = todayAppointments > 0 ? parseFloat(((todayNoShows / todayAppointments) * 100).toFixed(1)) : 0;

    return {
      kpis: {
        totalRegisteredPatients: totalPatients,
        todayTotalVisits: todayAppointments,
        todayCompletedVisits,
        todayNoShowRatePct: noShowRatePct,
        activeInpatients: admittedCount,
        totalBeds,
        bedOccupancyRatePct,
        totalRevenueRupees: (totalRevenueAggregate._sum.paidPaise || 0) / 100,
        pendingRevenueRupees: (pendingRevenueAggregate._sum.balancePaise || 0) / 100,
        completedDiagnosticsToday: completedLabOrdersToday,
        averageWaitMinutes: 18
      },
      charts: {
        thirtyDayTrend: historySnapshots.map((s) => ({
          date: s.snapshotDate,
          visits: s.totalVisits,
          admissions: s.totalAdmissions,
          occupancy: s.currentOccupancy,
          revenue: Number(s.totalRevenuePaise) / 100,
          pending: Number(s.pendingRevenuePaise) / 100
        }))
      }
    };
  }

  async getOpdReport(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate && endDate) {
      where.appointmentDate = {
        gte: new Date(`${startDate}T00:00:00.000Z`),
        lte: new Date(`${endDate}T23:59:59.999Z`)
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { appointmentDate: 'desc' },
      take: 100,
      include: {
        doctor: { include: { user: { select: { fullName: true } }, department: true } },
        consultation: { select: { diagnosis: true } }
      }
    });

    return appointments.map((a) => ({
      appointmentCode: a.appointmentCode,
      date: a.appointmentDate.toISOString().split('T')[0],
      slot: a.slotStartTime,
      doctor: a.doctor.user.fullName,
      department: a.doctor.department.name,
      status: a.status,
      type: a.type,
      diagnosis: a.consultation?.diagnosis || 'N/A'
    }));
  }

  async getRevenueReport() {
    const bills = await prisma.bill.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        payments: true
      }
    });

    return bills.map((b) => ({
      billNumber: b.billNumber,
      date: b.createdAt.toISOString().split('T')[0],
      encounterType: b.encounterType,
      status: b.status,
      subtotalRupees: b.subtotalPaise / 100,
      discountRupees: b.discountPaise / 100,
      totalRupees: b.totalPaise / 100,
      paidRupees: b.paidPaise / 100,
      balanceRupees: b.balancePaise / 100,
      paymentCount: b.payments.length
    }));
  }

  async runDailySnapshotJob() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999Z`);

    const [
      patientCount,
      visitCount,
      admCount,
      occupiedBeds,
      revAggr,
      pendingAggr,
      labCount,
      pharmacyCount
    ] = await Promise.all([
      prisma.patient.count({ where: { mergedIntoPatientId: null } }),
      prisma.appointment.count({ where: { appointmentDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.admission.count({ where: { admissionDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      prisma.payment.aggregate({
        where: { receivedAt: { gte: todayStart, lte: todayEnd } },
        _sum: { amountPaise: true }
      }),
      prisma.bill.aggregate({
        where: { status: 'DRAFT' },
        _sum: { balancePaise: true }
      }),
      prisma.diagnosticOrder.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' }
      }),
      prisma.dispenseRecord.count({
        where: { createdAt: { gte: todayStart, lte: todayEnd } }
      })
    ]);

    const snapshot = await prisma.dailySnapshot.upsert({
      where: { snapshotDate: todayStr },
      update: {
        totalPatients: patientCount,
        totalVisits: visitCount,
        totalAdmissions: admCount,
        currentOccupancy: occupiedBeds,
        totalRevenuePaise: BigInt(revAggr._sum.amountPaise || 0),
        pendingRevenuePaise: BigInt(pendingAggr._sum.balancePaise || 0),
        labOrdersCompleted: labCount,
        pharmacyDispenses: pharmacyCount
      },
      create: {
        snapshotDate: todayStr,
        totalPatients: patientCount,
        totalVisits: visitCount,
        totalAdmissions: admCount,
        currentOccupancy: occupiedBeds,
        totalRevenuePaise: BigInt(revAggr._sum.amountPaise || 0),
        pendingRevenuePaise: BigInt(pendingAggr._sum.balancePaise || 0),
        labOrdersCompleted: labCount,
        pharmacyDispenses: pharmacyCount
      }
    });

    return snapshot;
  }
}

export const analyticsService = new AnalyticsService();
