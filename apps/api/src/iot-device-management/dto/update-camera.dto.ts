import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * tenantId/cityId/zoneId are administered exclusively from this screen —
 * Dahua (or any provider) events never carry them, and
 * CameraIngestionCoreService never accepts them from a payload. See
 * docs/architecture/iot-device-management-foundation.md.
 */
export class UpdateCameraDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gatewayId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zoneId?: string;
}
