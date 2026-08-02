import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ParkingModule } from './parking/parking.module';
import { FrontendModule } from './frontend/frontend.module';
import { AuditModule } from './audit/audit.module';
import { RolesModule } from './roles/roles.module';
import { CameraGatewayModule } from './camera-gateway/camera-gateway.module';
import { IotDeviceManagementModule } from './iot-device-management/iot-device-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ParkingModule,
    FrontendModule,
    AuditModule,
    RolesModule,
    CameraGatewayModule,
    IotDeviceManagementModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
