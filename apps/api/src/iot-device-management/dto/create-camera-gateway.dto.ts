import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCameraGatewayDto {
  @ApiProperty({ example: '353e61ff-bc8f-4c2e-842c-d398c4357904' })
  @IsString()
  providerId: string;

  @ApiProperty({ example: 'DAHUA_ITSAPI_PILOT' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Dahua ITSAPI — Piloto' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'ITSAPI' })
  @IsString()
  protocol: string;

  @ApiProperty({ example: 'http://localhost:3000' })
  @IsString()
  publicBaseUrl: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  privateBaseUrl?: string;

  @ApiProperty({ example: '/integrations/dahua/NotificationInfo' })
  @IsString()
  basePath: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
