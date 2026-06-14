import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  @Roles('SUPER_ADMIN')
  @Get('zones')
  findZones() {
    return this.parkingService.findZones();
  }

  @Roles('SUPER_ADMIN')
  @Post('zones')
  createZone(@Body() body: any) {
    return this.parkingService.createZone(body);
  }

  @Roles('SUPER_ADMIN')
  @Get('spaces')
  findSpaces() {
    return this.parkingService.findSpaces();
  }

  @Roles('SUPER_ADMIN')
  @Post('spaces')
  createSpace(@Body() body: any) {
    return this.parkingService.createSpace(body);
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
