import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export const MAPPING_STATUSES = [
  'DISCOVERED',
  'MAPPED',
  'ACTIVE',
  'DISABLED',
  'CONFLICT',
] as const;

export class UpdateCameraStallMappingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parkingSpaceId?: string;

  @ApiProperty({ required: false, enum: MAPPING_STATUSES })
  @IsOptional()
  @IsIn(MAPPING_STATUSES)
  mappingStatus?: (typeof MAPPING_STATUSES)[number];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
