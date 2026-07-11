import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateRateDto {
  @ApiProperty({ example: '52362b5e-b627-4a77-938f-9641a0657c81' })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '0b6da071-c6e6-400a-a6fc-03652fd714a8' })
  @IsString()
  cityId: string;

  @ApiProperty({ example: 'Tarifa Zona Centro' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'CENTRO' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'USD', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 0.03 })
  @IsNumber()
  pricePerMinute: number;

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsNumber()
  minimumMinutes?: number;
}
