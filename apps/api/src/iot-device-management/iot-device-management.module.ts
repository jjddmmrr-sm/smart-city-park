import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IotDeviceManagementController } from './iot-device-management.controller';
import { IotDeviceManagementService } from './iot-device-management.service';

@Module({
  imports: [AuthModule],
  controllers: [IotDeviceManagementController],
  providers: [IotDeviceManagementService],
})
export class IotDeviceManagementModule {}
