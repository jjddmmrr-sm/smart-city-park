import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FrontendService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const totalSpaces = await this.prisma.parkingSpace.count();
    const occupiedSpaces = await this.prisma.parkingSpace.count({
      where: { status: 'occupied' },
    });
    const availableSpaces = await this.prisma.parkingSpace.count({
      where: { status: 'available' },
    });

    const activeSessions = await this.prisma.parkingSession.count({
      where: { status: 'active' },
    });

    const completedSessions = await this.prisma.parkingSession.count({
      where: { status: 'completed' },
    });

    const vehiclesToday = await this.prisma.vehicle.count();

    const revenue = await this.prisma.parkingSession.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    });

    return {
      totalSpaces,
      occupiedSpaces,
      availableSpaces,
      occupancyRate: totalSpaces > 0 ? Number(((occupiedSpaces / totalSpaces) * 100).toFixed(2)) : 0,
      vehiclesToday,
      revenueToday: revenue._sum.amount ?? 0,
      activeSessions,
      completedSessions,
      activeAlerts: 0,
      overstayCases: 0,
      unpaidCases: 0,
      ticketsIssued: 0,
      ticketsAmount: 0,
    };
  }
}
