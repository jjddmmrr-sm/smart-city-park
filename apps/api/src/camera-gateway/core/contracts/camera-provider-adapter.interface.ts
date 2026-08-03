/**
 * Provider adapter contract — see
 * docs/architecture/iot-device-management-foundation.md §3.
 *
 * This file must stay completely agnostic of any concrete manufacturer.
 * It must never import:
 *   - Dahua DTOs
 *   - the Dahua normalizer
 *   - the Dahua controller
 *   - Prisma / any persistence client
 *   - business services (CameraIngestionService, a future
 *     CameraIngestionCoreService, etc.)
 *   - any file under camera-gateway/providers/dahua
 *
 * A concrete manufacturer (Dahua today, others later) implements this
 * interface under camera-gateway/providers/<manufacturer>/ — this file
 * only defines what every adapter must be able to do, never how.
 */
import type {
  CanonicalCameraEvent,
  CanonicalCameraEventType,
} from './canonical-camera-event';

/**
 * Authentication strategies a provider's ingestion endpoint may use.
 * 'none' is a valid, explicit value — not the absence of one — for a
 * provider whose only defense is IP allowlisting at a layer above auth.
 */
export const CAMERA_PROVIDER_AUTH_STRATEGIES = [
  'ip_allowlist',
  'digest',
  'basic',
  'mtls',
  'none',
] as const;

export type CameraProviderAuthStrategy =
  (typeof CAMERA_PROVIDER_AUTH_STRATEGIES)[number];

export function isCameraProviderAuthStrategy(
  value: unknown,
): value is CameraProviderAuthStrategy {
  return (
    typeof value === 'string' &&
    (CAMERA_PROVIDER_AUTH_STRATEGIES as readonly string[]).includes(value)
  );
}

/**
 * A provider's capabilities are expressed as the set of canonical event
 * types it is able to produce — there is no separate capability
 * taxonomy to keep in sync with CanonicalCameraEventType.
 */
export type CameraProviderCapability = CanonicalCameraEventType;

/**
 * Lightweight, tolerant envelope produced by parseEvent() — captured
 * before structural validation, so it must be derivable even from a
 * malformed or partially-invalid payload (RAW-first persistence depends
 * on this: a CameraEventRaw row is written from this envelope before
 * validate() ever runs).
 */
export interface ProviderRawEvent {
  /** Device identifier extracted best-effort, '' if absent/unreadable. */
  externalDeviceId: string;

  /** Event type as named by the provider (Dahua: 'DeviceInfo', 'ParkingInfo', ...). */
  externalEventType: string;

  /** The original payload, untouched, for structural validation and normalization. */
  payload: unknown;
}

export interface CameraProviderValidationResult {
  valid: boolean;
  /** Empty when valid — never undefined, to avoid an extra null-check at call sites. */
  errors: string[];
}

/**
 * Contract every camera provider adapter must implement. See
 * docs/architecture/iot-device-management-foundation.md §3 for the
 * full request flow this participates in:
 *
 *   Controller → Adapter (this contract) → CanonicalCameraEvent → Core
 */
export interface CameraProviderAdapter {
  /** Provider identifier, e.g. 'DAHUA_ITSAPI'. Matches CameraProvider.code. */
  readonly code: string;

  /**
   * Interprets the raw HTTP payload and extracts the minimal tolerant
   * envelope needed to persist CameraEventRaw before any validation.
   * Must never throw on a malformed/unexpected payload — return a
   * best-effort envelope instead (externalDeviceId: '' if unreadable).
   */
  parseEvent(
    rawBody: unknown,
    headers: Record<string, unknown>,
    ip: string,
  ): ProviderRawEvent;

  /**
   * Structural validation of the envelope's payload, tolerant of
   * undeclared fields (never a whitelist/forbidNonWhitelisted pipe).
   */
  validate(rawEvent: ProviderRawEvent): CameraProviderValidationResult;

  /**
   * Authoritative device identifier, derived from the validated
   * payload — called after validate() succeeds. May differ from
   * parseEvent()'s best-effort externalDeviceId in how it's obtained,
   * even if the resulting value is typically the same.
   */
  resolveDeviceIdentifier(rawEvent: ProviderRawEvent): string;

  /**
   * Pure function — no I/O, no Prisma, no camera/tenant context. Translates
   * a validated raw event into the canonical, provider-agnostic event
   * shape using only what the wire payload itself carries — device/tenant
   * resolution is exclusively CameraIngestionCoreService's job, done
   * server-side from CanonicalCameraEvent.externalDeviceId, never passed
   * into the adapter. Implementations are expected to populate
   * CanonicalCameraEvent.idempotencyKey using the same value
   * computeIdempotencyKey() would produce for the same input.
   */
  normalize(
    rawEvent: ProviderRawEvent,
    rawEventId: string,
  ): CanonicalCameraEvent;

  /** Provider-specific idempotency formula (see CanonicalCameraEvent.idempotencyKey). */
  computeIdempotencyKey(rawEvent: ProviderRawEvent): string;

  /** Which canonical event types this provider is able to produce. */
  getCapabilities(): CameraProviderCapability[];

  /** Authentication strategy this provider's ingestion endpoint uses. */
  getAuthStrategy(): CameraProviderAuthStrategy;
}
