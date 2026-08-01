import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FrontendService } from './frontend.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Frontend')
@ApiBearerAuth()
@Controller('frontend')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
export class FrontendController {
  constructor(private readonly frontendService: FrontendService) {}

  @Get('overview')
  getOverview() {
    return this.frontendService.getOverview();
  }

  @Get('controllers')
  getControllers() {
    return this.frontendService.getControllers();
  }

  @Get('payments')
  getPayments() {
    return this.frontendService.getPayments();
  }

  @Get('fines')
  getFines() {
    return this.frontendService.getFines();
  }

  @Patch('fines/:id/status')
  updateFineStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.frontendService.updateFineStatus(id, body.status);
  }

  @Get('enforcement')
  getEnforcement() {
    return this.frontendService.getEnforcement();
  }

  @Patch('enforcement/:id/status')
  updateEnforcementStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.frontendService.updateEnforcementStatus(id, body.status);
  }

  @Get('zones')
  getZones() {
    return this.frontendService.getZones();
  }

  @Get('spaces')
  getSpaces() {
    return this.frontendService.getSpaces();
  }

  @Get('live')
  getLive() {
    return this.frontendService.getLive();
  }

  @Get('vehicles')
  getVehicles() {
    return this.frontendService.getVehicles();
  }
}
