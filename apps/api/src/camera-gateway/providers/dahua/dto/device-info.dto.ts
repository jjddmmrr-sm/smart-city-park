import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { DahuaEventBaseDto } from './dahua-event-base.dto';

export class DeviceInfoDto extends DahuaEventBaseDto {
  @ApiProperty({ required: false, example: 'ITC413-PW4D-IZ1' })
  @IsOptional()
  @IsString()
  DeviceModel?: string;

  @ApiProperty({ required: false, example: 'BM0F879PAJ5D7B6' })
  @IsOptional()
  @IsString()
  DeviceName?: string;

  @ApiProperty({ required: false, example: 'Tollgate' })
  @IsOptional()
  @IsString()
  DeviceType?: string;

  @ApiProperty({ required: false, example: '192.168.10.155' })
  @IsOptional()
  @IsString()
  IPAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  IPv6Address?: string;

  @ApiProperty({ required: false, example: '40:7a:a4:c8:92:04' })
  @IsOptional()
  @IsString()
  MACAddress?: string;

  @ApiProperty({ required: false, example: 'Dahua' })
  @IsOptional()
  @IsString()
  Manufacturer?: string;
}
