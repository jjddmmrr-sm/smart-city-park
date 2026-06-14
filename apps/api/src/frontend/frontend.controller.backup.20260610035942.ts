import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FrontendService } from './frontend.service';

@ApiTags('Frontend')
@Controller('frontend')
export class FrontendController {
  constructor(private readonly frontendService: FrontendService) {}

  @Get('overview')
  getOverview() {
    return this.frontendService.getOverview();
  }
}
