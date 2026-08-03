import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * tenantId/cityId are never accepted from the client — derived from the
 * authenticated user, same convention as ParkingService.createZone.
 */
export class CreateCameraGroupDto {
  @ApiProperty({ example: 'Zona Centro' })
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  gatewayId?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
