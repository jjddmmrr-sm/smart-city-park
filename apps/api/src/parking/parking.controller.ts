import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParkingService } from './parking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/jwt-payload.type';

type CreateZoneBody = Parameters<ParkingService['createZone']>[0];
type UpdateZoneBody = Parameters<ParkingService['updateZone']>[1];
type CreateSpaceBody = Parameters<ParkingService['createSpace']>[0];
type UpdateSpaceBody = Parameters<ParkingService['updateSpace']>[1];
type CreateControllerBody = Parameters<ParkingService['createController']>[0];
type UpdateControllerBody = Parameters<ParkingService['updateController']>[1];
type CreateVehicleBody = Parameters<ParkingService['createVehicle']>[0];
type CreateFineTypeBody = Parameters<ParkingService['createFineType']>[0];
type UpdateFineTypeBody = Parameters<ParkingService['updateFineType']>[1];
type CreatePaymentMethodBody = Parameters<
  ParkingService['createPaymentMethod']
>[0];
type UpdatePaymentMethodBody = Parameters<
  ParkingService['updatePaymentMethod']
>[1];
type CreateRateBody = Parameters<ParkingService['createRate']>[0];
type UpdateRateBody = Parameters<ParkingService['updateRate']>[1];
type StartSessionBody = Parameters<ParkingService['startSession']>[0];

@ApiTags('Parking')
@ApiBearerAuth()
@Controller('parking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('zones')
  findZones(@Req() req: AuthenticatedRequest) {
    return this.parkingService.findZones(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('zones')
  createZone(@Body() body: CreateZoneBody) {
    return this.parkingService.createZone(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() body: UpdateZoneBody) {
    return this.parkingService.updateZone(id, body);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('spaces')
  findSpaces(@Req() req: AuthenticatedRequest) {
    return this.parkingService.findSpaces(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('spaces')
  createSpace(@Body() body: CreateSpaceBody) {
    return this.parkingService.createSpace(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('spaces/:id')
  updateSpace(@Param('id') id: string, @Body() body: UpdateSpaceBody) {
    return this.parkingService.updateSpace(id, body);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('controllers')
  findControllers(@Req() req: AuthenticatedRequest) {
    return this.parkingService.findControllers(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('controllers')
  createController(@Body() body: CreateControllerBody) {
    return this.parkingService.createController(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('controllers/:id')
  updateController(
    @Param('id') id: string,
    @Body() body: UpdateControllerBody,
  ) {
    return this.parkingService.updateController(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('vehicles')
  findVehicles() {
    return this.parkingService.findVehicles();
  }

  @Roles('SUPER_ADMIN')
  @Post('vehicles')
  createVehicle(@Body() body: CreateVehicleBody) {
    return this.parkingService.createVehicle(body);
  }

  @Roles('SUPER_ADMIN')
  @Get('fine-types')
  findFineTypes() {
    return this.parkingService.findFineTypes();
  }

  @Roles('SUPER_ADMIN')
  @Post('fine-types')
  createFineType(@Body() body: CreateFineTypeBody) {
    return this.parkingService.createFineType(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('fine-types/:id')
  updateFineType(@Param('id') id: string, @Body() body: UpdateFineTypeBody) {
    return this.parkingService.updateFineType(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('payment-methods')
  findPaymentMethods() {
    return this.parkingService.findPaymentMethods();
  }

  @Roles('SUPER_ADMIN')
  @Post('payment-methods')
  createPaymentMethod(@Body() body: CreatePaymentMethodBody) {
    return this.parkingService.createPaymentMethod(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() body: UpdatePaymentMethodBody,
  ) {
    return this.parkingService.updatePaymentMethod(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('rates')
  findRates() {
    return this.parkingService.findRates();
  }

  @Roles('SUPER_ADMIN')
  @Post('rates')
  createRate(@Body() body: CreateRateBody) {
    return this.parkingService.createRate(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('rates/:id')
  updateRate(@Param('id') id: string, @Body() body: UpdateRateBody) {
    return this.parkingService.updateRate(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('sessions')
  findSessions() {
    return this.parkingService.findSessions();
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/start')
  startSession(@Body() body: StartSessionBody) {
    return this.parkingService.startSession(body);
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/:id/end')
  endSession(@Param('id') id: string) {
    return this.parkingService.endSession(id);
  }
}
