import { Test, TestingModule } from '@nestjs/testing';
import { FrontendService } from './frontend.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FrontendService', () => {
  let service: FrontendService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FrontendService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<FrontendService>(FrontendService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
