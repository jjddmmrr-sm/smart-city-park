import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParkingService } from './parking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

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
  findZones(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findZones(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('zones')
  createZone(@Body() body: CreateZoneBody, @CurrentUser() user: JwtPayload) {
    return this.parkingService.createZone(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('zones/:id')
  updateZone(
    @Param('id') id: string,
    @Body() body: UpdateZoneBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updateZone(id, body, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('spaces')
  findSpaces(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findSpaces(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('spaces')
  createSpace(@Body() body: CreateSpaceBody, @CurrentUser() user: JwtPayload) {
    return this.parkingService.createSpace(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('spaces/:id')
  updateSpace(
    @Param('id') id: string,
    @Body() body: UpdateSpaceBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updateSpace(id, body, user);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('controllers')
  findControllers(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findControllers(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('controllers')
  createController(
    @Body() body: CreateControllerBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.createController(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('controllers/:id')
  updateController(
    @Param('id') id: string,
    @Body() body: UpdateControllerBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updateController(id, body, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('vehicles')
  findVehicles(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findVehicles(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('vehicles')
  createVehicle(
    @Body() body: CreateVehicleBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.createVehicle(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('fine-types')
  findFineTypes(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findFineTypes(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('fine-types')
  createFineType(
    @Body() body: CreateFineTypeBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.createFineType(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('fine-types/:id')
  updateFineType(
    @Param('id') id: string,
    @Body() body: UpdateFineTypeBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updateFineType(id, body, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('payment-methods')
  findPaymentMethods(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findPaymentMethods(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('payment-methods')
  createPaymentMethod(
    @Body() body: CreatePaymentMethodBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.createPaymentMethod(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @Param('id') id: string,
    @Body() body: UpdatePaymentMethodBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updatePaymentMethod(id, body, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('rates')
  findRates(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findRates(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('rates')
  createRate(@Body() body: CreateRateBody, @CurrentUser() user: JwtPayload) {
    return this.parkingService.createRate(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Patch('rates/:id')
  updateRate(
    @Param('id') id: string,
    @Body() body: UpdateRateBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.updateRate(id, body, user);
  }

  @Roles('SUPER_ADMIN')
  @Get('sessions')
  findSessions(@CurrentUser() user: JwtPayload) {
    return this.parkingService.findSessions(user);
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/start')
  startSession(
    @Body() body: StartSessionBody,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.parkingService.startSession(body, user);
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/:id/end')
  endSession(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.parkingService.endSession(id, user);
  }
}
