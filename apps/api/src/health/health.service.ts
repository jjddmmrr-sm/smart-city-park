import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return {
      status: 'ok',
      service: 'smart-city-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseStatus() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
