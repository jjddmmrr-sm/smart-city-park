import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ example: '52362b5e-b627-4a77-938f-9641a0657c81' })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '0b6da071-c6e6-400a-a6fc-03652fd714a8' })
  @IsString()
  cityId: string;

  @ApiProperty({ example: 'ABC1234' })
  @IsString()
  plateNumber: string;

  @ApiProperty({ example: 'Santiago Muñoz', required: false })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiProperty({ example: '0999999999', required: false })
  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @ApiProperty({ example: 'santiago@email.com', required: false })
  @IsOptional()
  @IsString()
  ownerEmail?: string;
}
