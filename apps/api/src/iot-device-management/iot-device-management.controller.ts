import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IotDeviceManagementService,
  type CameraFilters,
  type MonitorFilters,
} from './iot-device-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CreateCameraProviderDto } from './dto/create-camera-provider.dto';
import { UpdateCameraProviderDto } from './dto/update-camera-provider.dto';
import { CreateCameraGatewayDto } from './dto/create-camera-gateway.dto';
import { UpdateCameraGatewayDto } from './dto/update-camera-gateway.dto';
import { CreateCameraGroupDto } from './dto/create-camera-group.dto';
import { UpdateCameraGroupDto } from './dto/update-camera-group.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { CreateCameraStallMappingDto } from './dto/create-camera-stall-mapping.dto';
import { UpdateCameraStallMappingDto } from './dto/update-camera-stall-mapping.dto';

/**
 * IoT Device Management — BackOffice administration for the multi-provider
 * Camera Gateway (see docs/architecture/iot-device-management-foundation.md).
 * Never touches CameraIngestionCoreService or any provider adapter —
 * administers the catalog/config those consume, nothing more.
 */
@ApiTags('IoT Device Management')
@ApiBearerAuth()
@Controller('iot-device-management')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IotDeviceManagementController {
  constructor(private readonly service: IotDeviceManagementService) {}

  // --- Dashboard ---------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user);
  }

  // --- Providers -----------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('providers')
  findProviders() {
    return this.service.findProviders();
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('providers/:id')
  findProvider(@Param('id') id: string) {
    return this.service.findProvider(id);
  }

  @Roles('SUPER_ADMIN')
  @Post('providers')
  createProvider(@Body() dto: CreateCameraProviderDto) {
    return this.service.createProvider(dto);
  }

  @Roles('SUPER_ADMIN')
  @Patch('providers/:id')
  updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateCameraProviderDto,
  ) {
    return this.service.updateProvider(id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Delete('providers/:id')
  deleteProvider(@Param('id') id: string) {
    return this.service.deleteProvider(id);
  }

  // --- Gateways ------------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('gateways')
  findGateways() {
    return this.service.findGateways();
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('gateways/:id')
  findGateway(@Param('id') id: string) {
    return this.service.findGateway(id);
  }

  @Roles('SUPER_ADMIN')
  @Post('gateways')
  createGateway(@Body() dto: CreateCameraGatewayDto) {
    return this.service.createGateway(dto);
  }

  @Roles('SUPER_ADMIN')
  @Patch('gateways/:id')
  updateGateway(@Param('id') id: string, @Body() dto: UpdateCameraGatewayDto) {
    return this.service.updateGateway(id, dto);
  }

  @Roles('SUPER_ADMIN')
  @Delete('gateways/:id')
  deleteGateway(@Param('id') id: string) {
    return this.service.deleteGateway(id);
  }

  // --- Groups --------------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('groups')
  findGroups(@CurrentUser() user: JwtPayload) {
    return this.service.findGroups(user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('groups/:id')
  findGroup(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findGroup(id, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('groups')
  createGroup(
    @Body() dto: CreateCameraGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createGroup(dto, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('groups/:id')
  updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdateCameraGroupDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateGroup(id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.deleteGroup(id, user);
  }

  // --- Cameras ---------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('cameras')
  findCameras(
    @CurrentUser() user: JwtPayload,
    @Query() filters: CameraFilters,
  ) {
    return this.service.findCameras(user, filters);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('cameras/:id')
  findCamera(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findCamera(id, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('cameras/:id')
  updateCamera(
    @Param('id') id: string,
    @Body() dto: UpdateCameraDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateCamera(id, dto, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('cameras/:id/approve')
  approveCamera(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.approveCamera(id, user);
  }

  // --- Stall mappings ----------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('mappings')
  findMappings(
    @CurrentUser() user: JwtPayload,
    @Query('cameraId') cameraId?: string,
  ) {
    return cameraId
      ? this.service.findMappingsByCamera(cameraId, user)
      : this.service.findMappings(user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('mappings/parking-space-candidates/:cameraId')
  findParkingSpaceCandidates(
    @Param('cameraId') cameraId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findParkingSpaceCandidates(cameraId, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Post('mappings')
  createMapping(
    @Body() dto: CreateCameraStallMappingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createMapping(dto, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch('mappings/:id')
  updateMapping(
    @Param('id') id: string,
    @Body() dto: UpdateCameraStallMappingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateMapping(id, dto, user);
  }

  // --- Monitor -------------------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('monitor/events')
  findMonitorEvents(
    @CurrentUser() user: JwtPayload,
    @Query() filters: MonitorFilters,
  ) {
    return this.service.findMonitorEvents(user, filters);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('monitor/events/:id')
  findMonitorEvent(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findMonitorEvent(id, user);
  }

  // --- Diagnostics -----------------------------------------------------

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR')
  @Get('diagnostics/:cameraId')
  getCameraDiagnostics(
    @Param('cameraId') cameraId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getCameraDiagnostics(cameraId, user);
  }
}
