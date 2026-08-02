import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ParkingInfoPlateDto {
  @IsBoolean()
  IsExist: boolean;

  @IsOptional()
  @IsString()
  PlateNumber?: string;

  @IsOptional()
  @IsNumber()
  Confidence?: number;

  @IsOptional()
  @IsString()
  PlateColor?: string;

  @IsOptional()
  @IsString()
  Region?: string;
}

export class ParkingInfoVehicleDto {
  @IsOptional()
  @IsString()
  VehicleSeries?: string;
}

export class ParkingInfoBlockDto {
  @IsString()
  DeviceID: string;

  @IsOptional()
  @IsString()
  ParkingStallsNo?: string;

  @IsNumber()
  ParkingStatus: number;

  @IsOptional()
  @IsString()
  DetectRegionName?: string;

  @IsOptional()
  @IsString()
  SnapTime?: string;

  @IsOptional()
  @IsNumber()
  Channel?: number;

  @IsOptional()
  @IsNumber()
  TimeZone?: number;

  @IsOptional()
  @IsBoolean()
  AllowUser?: boolean;

  @IsOptional()
  @IsString()
  inRecordId?: string;
}

export class PictureDto {
  @ValidateNested()
  @Type(() => ParkingInfoBlockDto)
  ParkingInfo: ParkingInfoBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParkingInfoPlateDto)
  Plate?: ParkingInfoPlateDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ParkingInfoVehicleDto)
  Vehicle?: ParkingInfoVehicleDto;
}

/**
 * NormalPic/VehiclePic/CutoutPic/CombinPic/Plate.Content (Base64 imagery) are
 * intentionally not modeled here — image handling is out of scope for this
 * commit. They pass through untouched in CameraEventRaw.payload and are
 * simply ignored by validation (tolerant, no forbidNonWhitelisted).
 */
export class ParkingInfoDto {
  @ValidateNested()
  @Type(() => PictureDto)
  Picture: PictureDto;
}
