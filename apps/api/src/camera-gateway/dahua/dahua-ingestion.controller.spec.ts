import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DahuaIngestionController } from './dahua-ingestion.controller';
import { CameraIngestionService } from '../camera-ingestion.service';

describe('DahuaIngestionController', () => {
  let controller: DahuaIngestionController;
  let service: {
    handleDeviceInfo: jest.Mock;
    handleKeepAlive: jest.Mock;
    handleParkingInfo: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      handleDeviceInfo: jest.fn().mockResolvedValue({ status: 'ok' }),
      handleKeepAlive: jest.fn().mockResolvedValue({ status: 'ok' }),
      handleParkingInfo: jest.fn().mockResolvedValue({ status: 'ok' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DahuaIngestionController],
      providers: [{ provide: CameraIngestionService, useValue: service }],
    }).compile();

    controller = module.get<DahuaIngestionController>(DahuaIngestionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('is never behind JwtAuthGuard — cameras cannot present a Bearer token', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      DahuaIngestionController,
    ) as unknown[] | undefined;
    expect(guards ?? []).toHaveLength(0);
  });

  it('delegates DeviceInfo to CameraIngestionService.handleDeviceInfo', async () => {
    const body = { DeviceID: 'device-1' };
    const headers = { authorization: 'Bearer x' };

    const result = await controller.handleDeviceInfo(
      body,
      '192.168.10.155',
      headers,
    );

    expect(service.handleDeviceInfo).toHaveBeenCalledWith(
      body,
      '192.168.10.155',
      headers,
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('delegates KeepAlive to CameraIngestionService.handleKeepAlive', async () => {
    const body = { DeviceID: 'device-1' };
    const headers = { authorization: 'Bearer x' };

    const result = await controller.handleKeepAlive(
      body,
      '192.168.10.155',
      headers,
    );

    expect(service.handleKeepAlive).toHaveBeenCalledWith(
      body,
      '192.168.10.155',
      headers,
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('delegates ParkingInfo to CameraIngestionService.handleParkingInfo', async () => {
    const body = { Picture: { ParkingInfo: { DeviceID: 'device-1' } } };
    const headers = { authorization: 'Bearer x' };

    const result = await controller.handleParkingInfo(
      body,
      '192.168.10.155',
      headers,
    );

    expect(service.handleParkingInfo).toHaveBeenCalledWith(
      body,
      '192.168.10.155',
      headers,
    );
    expect(result).toEqual({ status: 'ok' });
  });
});
