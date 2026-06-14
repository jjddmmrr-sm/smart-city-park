import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FrontendService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const totalSpaces = await this.prisma.parkingSpace.count();
    const occupiedSpaces = await this.prisma.parkingSpace.count({ where: { status: 'occupied' } });
    const availableSpaces = await this.prisma.parkingSpace.count({ where: { status: 'available' } });
    const activeSessions = await this.prisma.parkingSession.count({ where: { status: 'active' } });
    const completedSessions = await this.prisma.parkingSession.count({ where: { status: 'completed' } });
    const vehiclesToday = await this.prisma.vehicle.count();

    const revenue = await this.prisma.parkingSession.aggregate({
      where: { status: 'completed' },
      _sum: { amount: true },
    });

    const fines = await this.prisma.fine.aggregate({
      _sum: { amount: true },
      _count: { id: true },
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
      activeAlerts: await this.prisma.enforcementCase.count({ where: { status: 'pending' } }),
      overstayCases: await this.prisma.enforcementCase.count({ where: { issue: 'overstay' } }),
      unpaidCases: await this.prisma.enforcementCase.count({ where: { issue: 'no_payment' } }),
      ticketsIssued: fines._count.id,
      ticketsAmount: fines._sum.amount ?? 0,
    };
  }

  async getControllers() {
    const inspectors = await this.prisma.inspector.findMany({
      include: { assignedZone: true },
      orderBy: { createdAt: 'desc' },
    });

    return inspectors.map((i) => ({
      controlador_id: i.id,
      nombre: i.name,
      zona_asignada: i.assignedZone?.name ?? 'Sin zona asignada',
      turno: i.shift,
      estado: i.status,
      fecha_ingreso: i.createdAt.toISOString().slice(0, 10),
      dispositivo_id: i.deviceId ?? 'N/A',
    }));
  }

  async getPayments() {
    const payments = await this.prisma.payment.findMany({
      include: { paymentMethod: true, city: true },
      orderBy: { paidAt: 'desc' },
    });

    return payments.map((p) => ({
      fecha: p.paidAt.toISOString().slice(0, 10),
      zona: p.city.name,
      metodo_pago_codigo: p.paymentMethod.code.toLowerCase(),
      metodo_pago_descripcion: p.paymentMethod.name,
      transacciones: 1,
      monto_total_usd: p.amount,
      tickets_promedio_usd: p.amount,
      porcentaje_participacion: 100,
    }));
  }

  async getFines() {
    const fines = await this.prisma.fine.findMany({
      include: { fineType: true, inspector: true, city: true },
      orderBy: { issuedAt: 'desc' },
    });

    return fines.map((f) => ({
      multa_id: f.id,
      fecha_hora: f.issuedAt.toISOString(),
      placa: f.plateNumber,
      zona: f.city.name,
      calle: 'Zona Centro',
      motivo_codigo: f.fineType.code.toLowerCase(),
      motivo_descripcion: f.fineType.name,
      valor_multa_usd: f.amount,
      controlador_id: f.inspectorId ?? 'N/A',
      evidencia_foto: f.evidenceUrl ? 'si' : 'no',
      estado_multa: f.status,
      prioridad: f.priority,
      observacion: f.observation ?? '',
    }));
  }

  async getEnforcement() {
    const cases = await this.prisma.enforcementCase.findMany({
      include: { city: true },
      orderBy: { detectedAt: 'desc' },
    });

    return cases.map((c) => ({
      id: c.id,
      date: c.detectedAt.toISOString().slice(0, 10),
      plate: c.plateNumber,
      zone_id: c.cityId,
      zone: c.city.name,
      street: 'Zona Centro',
      issue: c.issue,
      detected: c.detectedAt.toISOString(),
      status: c.status,
      priority: c.priority,
    }));
  }

  async getZones() {
    const zones = await this.prisma.parkingZone.findMany({
      include: {
        spaces: true,
      },
      orderBy: { name: 'asc' },
    });

    const rates = await this.prisma.parkingRate.findMany({
      where: { status: 'active' },
    });

    return zones.map((z) => {
      const rate = rates.find((r) => r.cityId === z.cityId);
      return {
        zone_id: z.id,
        zone_name: z.name,
        spaces: z.spaces.length,
        tariff: rate?.pricePerMinute ?? 0,
        occupancy_base: z.spaces.length
          ? z.spaces.filter((s) => s.status === 'occupied').length / z.spaces.length
          : 0,
        streets: [z.name],
      };
    });
  }

  async getSpaces() {
    const spaces = await this.prisma.parkingSpace.findMany({
      include: {
        zone: true,
      },
      orderBy: { code: 'asc' },
    });

    const rates = await this.prisma.parkingRate.findMany({
      where: { status: 'active' },
    });

    return spaces.map((s) => {
      const rate = rates.find((r) => r.cityId === s.cityId);
      return {
        id: s.code,
        zone_id: s.zoneId,
        zone: s.zone.name,
        street: s.zone.name,
        lat: s.latitude ?? -0.698,
        lng: s.longitude ?? -80.093,
        type: s.type,
        sensor: true,
        tariff: rate?.pricePerMinute ?? 0,
      };
    });
  }

  async getLive() {
    const spaces = await this.prisma.parkingSpace.findMany({
      include: {
        zone: true,
        sessions: {
          where: { status: 'active' },
          include: { vehicle: true },
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });

    return spaces.map((s) => {
      const active = s.sessions[0];
      return {
        id: s.code,
        zone_id: s.zoneId,
        zone: s.zone.name,
        street: s.zone.name,
        lat: s.latitude ?? -0.698,
        lng: s.longitude ?? -80.093,
        status: s.status,
        type: s.type,
        sensor: true,
        plate: active?.vehicle?.plateNumber ?? '',
        since: active?.startedAt?.toISOString() ?? '',
      };
    });
  }

  async updateFineStatus(id: string, status: string) {
    return this.prisma.fine.update({
      where: { id },
      data: {
        status,
        paidAt: status === 'paid' ? new Date() : null,
      },
    });
  }

  async getVehicles() {
    const sessions = await this.prisma.parkingSession.findMany({
      include: {
        vehicle: true,
        space: {
          include: { zone: true },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    return sessions.map((s) => ({
      id: s.id,
      date: s.startedAt.toISOString().slice(0, 10),
      plate: s.vehicle.plateNumber,
      brand: 'N/A',
      model: 'N/A',
      color: 'N/A',
      type: s.space.type,
      zone_id: s.space.zoneId,
      zone: s.space.zone.name,
      street: s.space.zone.name,
      start: s.startedAt.toISOString(),
      end: s.endedAt?.toISOString() ?? '',
      duration: s.endedAt
        ? Math.ceil((s.endedAt.getTime() - s.startedAt.getTime()) / 60000)
        : Math.ceil((Date.now() - s.startedAt.getTime()) / 60000),
      payment: s.status === 'completed' ? 'paid' : 'unpaid',
      compliance: s.status === 'completed' ? 'valid' : 'no_payment',
    }));
  }

}
