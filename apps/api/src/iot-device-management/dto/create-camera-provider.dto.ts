import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCameraProviderDto {
  @ApiProperty({ example: 'DAHUA_ITSAPI' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Dahua ITSAPI' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ITSAPI' })
  @IsString()
  protocol: string;

  @ApiProperty({
    example: ['DEVICE_HANDSHAKE', 'HEARTBEAT', 'OCCUPANCY_UPDATE'],
  })
  @IsArray()
  capabilities: string[];

  @ApiProperty({ example: 'ip_allowlist' })
  @IsString()
  defaultAuthMode: string;

  @ApiProperty({
    example: {
      DEVICE_HANDSHAKE: '/DeviceInfo',
      HEARTBEAT: '/KeepAlive',
      OCCUPANCY_UPDATE: '/ParkingInfo',
    },
  })
  @IsObject()
  endpointTemplates: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supportUrl?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
