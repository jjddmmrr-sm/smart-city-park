import { Test, TestingModule } from '@nestjs/testing';
import { IotDeviceManagementController } from './iot-device-management.controller';
import { IotDeviceManagementService } from './iot-device-management.service';

describe('IotDeviceManagementController', () => {
  let controller: IotDeviceManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IotDeviceManagementController],
      providers: [{ provide: IotDeviceManagementService, useValue: {} }],
    }).compile();

    controller = module.get<IotDeviceManagementController>(
      IotDeviceManagementController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
