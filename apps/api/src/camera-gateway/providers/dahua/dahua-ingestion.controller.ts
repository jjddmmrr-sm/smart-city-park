import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CameraIngestionService } from '../../camera-ingestion.service';

/**
 * Dahua ITSAPI ingestion — never behind JwtAuthGuard. Cameras cannot present
 * a Bearer token. Scope of this commit: DeviceInfo only.
 * Mounted outside /api/v1 — see main.ts prefix exclusion.
 */
@ApiExcludeController()
@Controller('integrations/dahua/NotificationInfo')
export class DahuaIngestionController {
  constructor(private readonly ingestionService: CameraIngestionService) {}

  @Post('DeviceInfo')
  @HttpCode(HttpStatus.OK)
  handleDeviceInfo(
    @Body() body: Record<string, unknown>,
    @Ip() ip: string,
    @Headers() headers: Record<string, unknown>,
  ) {
    return this.ingestionService.handleDeviceInfo(body, ip, headers);
  }

  @Post('KeepAlive')
  @HttpCode(HttpStatus.OK)
  handleKeepAlive(
    @Body() body: Record<string, unknown>,
    @Ip() ip: string,
    @Headers() headers: Record<string, unknown>,
  ) {
    return this.ingestionService.handleKeepAlive(body, ip, headers);
  }

  @Post('ParkingInfo')
  @HttpCode(HttpStatus.OK)
  handleParkingInfo(
    @Body() body: Record<string, unknown>,
    @Ip() ip: string,
    @Headers() headers: Record<string, unknown>,
  ) {
    return this.ingestionService.handleParkingInfo(body, ip, headers);
  }
}
