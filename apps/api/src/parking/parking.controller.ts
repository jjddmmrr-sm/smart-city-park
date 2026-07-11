import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ParkingService } from './parking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Parking')
@ApiBearerAuth()
@Controller('parking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('zones')
  findZones(@Req() req: any) {
    return this.parkingService.findZones(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('zones')
  createZone(@Body() body: any) {
    return this.parkingService.createZone(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updateZone(id, body);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('spaces')
  findSpaces(@Req() req: any) {
    return this.parkingService.findSpaces(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('spaces')
  createSpace(@Body() body: any) {
    return this.parkingService.createSpace(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('spaces/:id')
  updateSpace(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updateSpace(id, body);
  }

  @Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
  @Get('controllers')
  findControllers(@Req() req: any) {
    return this.parkingService.findControllers(req.user);
  }

  @Roles('SUPER_ADMIN')
  @Post('controllers')
  createController(@Body() body: any) {
    return this.parkingService.createController(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('controllers/:id')
  updateController(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updateController(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('vehicles')
  findVehicles() {
    return this.parkingService.findVehicles();
  }

  @Roles('SUPER_ADMIN')
  @Post('vehicles')
  createVehicle(@Body() body: any) {
    return this.parkingService.createVehicle(body);
  }

  @Roles('SUPER_ADMIN')
  @Get('fine-types')
  findFineTypes() {
    return this.parkingService.findFineTypes();
  }

  @Roles('SUPER_ADMIN')
  @Post('fine-types')
  createFineType(@Body() body: any) {
    return this.parkingService.createFineType(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('fine-types/:id')
  updateFineType(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updateFineType(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('payment-methods')
  findPaymentMethods() {
    return this.parkingService.findPaymentMethods();
  }

  @Roles('SUPER_ADMIN')
  @Post('payment-methods')
  createPaymentMethod(@Body() body: any) {
    return this.parkingService.createPaymentMethod(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('payment-methods/:id')
  updatePaymentMethod(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updatePaymentMethod(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('rates')
  findRates() {
    return this.parkingService.findRates();
  }

  @Roles('SUPER_ADMIN')
  @Post('rates')
  createRate(@Body() body: any) {
    return this.parkingService.createRate(body);
  }

  @Roles('SUPER_ADMIN')
  @Patch('rates/:id')
  updateRate(@Param('id') id: string, @Body() body: any) {
    return this.parkingService.updateRate(id, body);
  }

  @Roles('SUPER_ADMIN')
  @Get('sessions')
  findSessions() {
    return this.parkingService.findSessions();
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/start')
  startSession(@Body() body: any) {
    return this.parkingService.startSession(body);
  }

  @Roles('SUPER_ADMIN')
  @Post('sessions/:id/end')
  endSession(@Param('id') id: string) {
    return this.parkingService.endSession(id);
  }
}
