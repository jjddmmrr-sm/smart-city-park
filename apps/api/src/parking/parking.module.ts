import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';

@Module({
  imports: [AuthModule],
  controllers: [ParkingController],
  providers: [ParkingService],
})
export class ParkingModule {}
