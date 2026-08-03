import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCameraStallMappingDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  @IsString()
  cameraId: string;

  @ApiProperty({ example: 'A004' })
  @IsString()
  externalStallCode: string;

  @ApiProperty({ required: false, example: 'b2c3d4e5-...' })
  @IsOptional()
  @IsString()
  parkingSpaceId?: string;
}
