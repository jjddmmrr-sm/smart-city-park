import {
  CAMERA_PROVIDER_AUTH_STRATEGIES,
  isCameraProviderAuthStrategy,
} from './camera-provider-adapter.interface';

describe('CAMERA_PROVIDER_AUTH_STRATEGIES', () => {
  it('contains exactly the 5 minimum strategies, no duplicates', () => {
    expect(CAMERA_PROVIDER_AUTH_STRATEGIES).toEqual([
      'ip_allowlist',
      'digest',
      'basic',
      'mtls',
      'none',
    ]);
    expect(new Set(CAMERA_PROVIDER_AUTH_STRATEGIES).size).toBe(
      CAMERA_PROVIDER_AUTH_STRATEGIES.length,
    );
  });
});

describe('isCameraProviderAuthStrategy', () => {
  it('accepts every declared strategy', () => {
    for (const strategy of CAMERA_PROVIDER_AUTH_STRATEGIES) {
      expect(isCameraProviderAuthStrategy(strategy)).toBe(true);
    }
  });

  it('treats "none" as a valid explicit strategy, not an absent value', () => {
    expect(isCameraProviderAuthStrategy('none')).toBe(true);
  });

  it('rejects unrelated or malformed values', () => {
    expect(isCameraProviderAuthStrategy('oauth2')).toBe(false);
    expect(isCameraProviderAuthStrategy(undefined)).toBe(false);
    expect(isCameraProviderAuthStrategy(null)).toBe(false);
    expect(isCameraProviderAuthStrategy(123)).toBe(false);
  });
});
