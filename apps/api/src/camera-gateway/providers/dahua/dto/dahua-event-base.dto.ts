import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Common envelope shared by every Dahua ITSAPI NotificationInfo event.
 * Concrete event DTOs (DeviceInfo, ParkingInfo, ...) extend this base
 * once the ingestion controller is implemented — see commit 3.
 */
export abstract class DahuaEventBaseDto {
  @ApiProperty({ example: '1a85820a-9edf-406a-8338-170689f6099e' })
  @IsString()
  DeviceID: string;
}
