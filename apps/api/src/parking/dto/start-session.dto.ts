import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({ example: '52362b5e-b627-4a77-938f-9641a0657c81' })
  @IsString()
  tenantId: string;

  @ApiProperty({ example: '0b6da071-c6e6-400a-a6fc-03652fd714a8' })
  @IsString()
  cityId: string;

  @ApiProperty({ example: '1c2d029f-fd4e-4827-97a8-0b3a68418251' })
  @IsString()
  spaceId: string;

  @ApiProperty({ example: '5ad68c00-79e7-4546-a1bb-264dae586053' })
  @IsString()
  vehicleId: string;
}
