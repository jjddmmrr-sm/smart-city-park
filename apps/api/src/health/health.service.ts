import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      status: 'ok',
      service: 'smart-city-api',
      timestamp: new Date().toISOString(),
    };
  }
}
