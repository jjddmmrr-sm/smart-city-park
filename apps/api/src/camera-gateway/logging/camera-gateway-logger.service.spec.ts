import { CameraGatewayLogger } from './camera-gateway-logger.service';

describe('CameraGatewayLogger', () => {
  it('should be defined', () => {
    expect(new CameraGatewayLogger()).toBeDefined();
  });

  describe('redactHeaders', () => {
    it('redacts sensitive headers regardless of casing', () => {
      const result = CameraGatewayLogger.redactHeaders({
        Authorization: 'Bearer secret',
        Cookie: 'session=abc',
        'X-Forwarded-For': '10.0.0.1',
      });

      expect(result).toEqual({
        Authorization: '[REDACTED]',
        Cookie: '[REDACTED]',
        'X-Forwarded-For': '10.0.0.1',
      });
    });

    it('leaves an empty header set untouched', () => {
      expect(CameraGatewayLogger.redactHeaders({})).toEqual({});
    });
  });

  describe('summarizeBase64', () => {
    it('returns the content length instead of the raw content', () => {
      expect(CameraGatewayLogger.summarizeBase64('abcd')).toEqual({
        length: 4,
      });
    });

    it('returns undefined for empty or missing content', () => {
      expect(CameraGatewayLogger.summarizeBase64(undefined)).toBeUndefined();
      expect(CameraGatewayLogger.summarizeBase64('')).toBeUndefined();
    });
  });
});
