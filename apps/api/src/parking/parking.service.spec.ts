import { Test, TestingModule } from '@nestjs/testing';
import { ParkingService } from './parking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ParkingService', () => {
  let service: ParkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ParkingService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<ParkingService>(ParkingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
