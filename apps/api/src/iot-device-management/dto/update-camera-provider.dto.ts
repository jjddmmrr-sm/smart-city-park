import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCameraProviderDto {
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
  @IsArray()
  capabilities?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  defaultAuthMode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  endpointTemplates?: Record<string, string>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  documentationUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  supportUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
