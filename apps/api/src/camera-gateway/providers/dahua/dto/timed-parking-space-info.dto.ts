import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/**
 * One entry of SpaceModeInfo[] — one reported stall. SpaceType is kept
 * available on the normalized model (see normalize() in the adapter)
 * even though it does not govern occupancy today, per the firmware
 * change note: only `Used` decides OCCUPIED/AVAILABLE.
 */
export class SpaceModeInfoDto {
  @IsOptional()
  @IsString()
  ParkNo?: string;

  @IsOptional()
  @IsNumber()
  SpaceType?: number;

  @IsOptional()
  @IsBoolean()
  Used?: boolean;
}

/**
 * ParkingSpacePic.Content (Base64 snapshot) is intentionally typed as a
 * plain optional string, never decoded/logged — see
 * CameraGatewayLogger.summarizeBase64 and main.ts's traffic-capture
 * summarizer, both of which only ever report its length.
 */
export class TimedParkingSpacePicDto {
  @IsOptional()
  @IsString()
  Content?: string;

  @IsOptional()
  @IsString()
  PicName?: string;
}

/**
 * DSTTune/EventID/StatisticsMode/TimeZone/TimingPeriod/
 * ViolationSnapSource travel through untouched in CameraEventRaw.payload
 * and are deliberately not modeled here — same tolerant-of-undeclared-
 * fields approach already used by ParkingInfoDto.
 */
export class TimedParkingSpaceInfoDto {
  @IsString()
  DeviceID: string;

  @IsOptional()
  @IsString()
  Time?: string;

  @IsOptional()
  @IsNumber()
  EventID?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaceModeInfoDto)
  SpaceModeInfo: SpaceModeInfoDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TimedParkingSpacePicDto)
  ParkingSpacePic?: TimedParkingSpacePicDto;
}
