import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FrontendService } from './frontend.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('Frontend')
@ApiBearerAuth()
@Controller('frontend')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS')
export class FrontendController {
  constructor(private readonly frontendService: FrontendService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getOverview(user);
  }

  @Get('controllers')
  getControllers(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getControllers(user);
  }

  @Get('payments')
  getPayments(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getPayments(user);
  }

  @Get('fines')
  getFines(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getFines(user);
  }

  @Patch('fines/:id/status')
  updateFineStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.frontendService.updateFineStatus(id, body.status, user);
  }

  @Get('enforcement')
  getEnforcement(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getEnforcement(user);
  }

  @Patch('enforcement/:id/status')
  updateEnforcementStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.frontendService.updateEnforcementStatus(id, body.status, user);
  }

  @Get('zones')
  getZones(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getZones(user);
  }

  @Get('spaces')
  getSpaces(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getSpaces(user);
  }

  @Get('live')
  getLive(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getLive(user);
  }

  @Get('vehicles')
  getVehicles(@CurrentUser() user: JwtPayload) {
    return this.frontendService.getVehicles(user);
  }
}
