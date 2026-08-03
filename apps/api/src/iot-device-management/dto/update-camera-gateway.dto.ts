import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCameraGatewayDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  protocol?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  publicBaseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  privateBaseUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  basePath?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
