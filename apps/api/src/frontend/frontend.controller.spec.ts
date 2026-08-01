import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { FrontendController } from './frontend.controller';
import { FrontendService } from './frontend.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('FrontendController', () => {
  let controller: FrontendController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FrontendController],
      providers: [{ provide: FrontendService, useValue: {} }],
    }).compile();

    controller = module.get<FrontendController>(FrontendController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('requires JwtAuthGuard and RolesGuard on every route', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, FrontendController) as
      | unknown[]
      | undefined;

    expect(guards).toBeDefined();
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('restricts access to operational roles only', () => {
    const reflector = new Reflector();
    const roles = reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      FrontendController,
    ]);

    expect(roles).toEqual(
      expect.arrayContaining(['SUPER_ADMIN', 'ADMIN', 'OPERADOR', 'FINANZAS']),
    );
  });
});
