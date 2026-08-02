import { Injectable, Logger } from '@nestjs/common';

const SENSITIVE_HEADER_KEYS = ['authorization', 'cookie', 'set-cookie'];

/**
 * Structured logger for the camera-gateway module. Enforces the redaction
 * rules from DAHUA_IMPLEMENTATION_PLAN.md §8: never log full Base64 image
 * content, never log sensitive headers.
 */
@Injectable()
export class CameraGatewayLogger extends Logger {
  constructor() {
    super('CameraGateway');
  }

  static redactHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(headers)) {
      redacted[key] = SENSITIVE_HEADER_KEYS.includes(key.toLowerCase())
        ? '[REDACTED]'
        : value;
    }
    return redacted;
  }

  static summarizeBase64(
    content: string | undefined | null,
  ): { length: number } | undefined {
    if (!content) {
      return undefined;
    }
    return { length: content.length };
  }
}
