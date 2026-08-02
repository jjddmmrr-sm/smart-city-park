/**
 * Canonical, provider-agnostic camera event contract — see
 * docs/architecture/iot-device-management-foundation.md §4.
 *
 * Nothing in this file may depend on any concrete manufacturer. Every
 * provider adapter (Dahua today, others later) is responsible for
 * translating its own wire vocabulary into this shape — the core
 * ingestion service consumes only this type, never a provider DTO.
 */

/**
 * AVAILABLE is the canonical "free space" state.
 *
 * Dahua's own runtime vocabulary uses `FREE` internally (see
 * camera-gateway/providers/dahua/types.ts, DahuaOccupancyStatus) — that
 * translation from FREE (or any other manufacturer's wording) to
 * AVAILABLE belongs exclusively to the provider adapter's `normalize()`.
 * The core must never see a manufacturer-specific status word, and it
 * must never see Dahua's numeric `ParkingStatus` codes (0/1/2/3/4/7) —
 * those are translated away entirely inside the Dahua adapter.
 */
export const CANONICAL_PARKING_STATUSES = [
  'OCCUPIED',
  'AVAILABLE',
  'ILLEGAL',
  'DETECTION',
  'UNKNOWN',
] as const;

export type CanonicalParkingStatus =
  (typeof CANONICAL_PARKING_STATUSES)[number];

export function isCanonicalParkingStatus(
  value: unknown,
): value is CanonicalParkingStatus {
  return (
    typeof value === 'string' &&
    (CANONICAL_PARKING_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Canonical event kinds, independent of how each manufacturer names its
 * own endpoints/messages (Dahua: DeviceInfo/KeepAlive/ParkingInfo; other
 * providers will name theirs differently).
 *
 * - DEVICE_HANDSHAKE — device identity/registration event (Dahua: DeviceInfo)
 * - HEARTBEAT        — liveness signal only (Dahua: KeepAlive)
 * - OCCUPANCY_UPDATE — occupancy/detection event carrying parkingStatus (Dahua: ParkingInfo)
 * - UNCLASSIFIED      — anything captured as RAW without normalized business meaning yet
 */
export const CANONICAL_CAMERA_EVENT_TYPES = [
  'DEVICE_HANDSHAKE',
  'HEARTBEAT',
  'OCCUPANCY_UPDATE',
  'UNCLASSIFIED',
] as const;

export type CanonicalCameraEventType =
  (typeof CANONICAL_CAMERA_EVENT_TYPES)[number];

export function isCanonicalCameraEventType(
  value: unknown,
): value is CanonicalCameraEventType {
  return (
    typeof value === 'string' &&
    (CANONICAL_CAMERA_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export interface CanonicalCameraEventPlate {
  exists: boolean;
  number?: string;
  confidence?: number;
  color?: string;
  region?: string;
}

export interface CanonicalCameraEventVehicle {
  type?: string;
  color?: string;
  brand?: string;
}

/**
 * Canonical, provider-agnostic representation of any event received from
 * any camera provider adapter. Produced exclusively by
 * CameraProviderAdapter.normalize() — see camera-provider-adapter.interface.ts.
 */
export interface CanonicalCameraEvent {
  /** Which provider adapter produced this event, e.g. 'DAHUA_ITSAPI'. */
  providerCode: string;

  /** Device identifier in the provider's own vocabulary (Dahua: DeviceID). */
  externalDeviceId: string;

  /** Event type as named by the provider (Dahua: 'DeviceInfo' | 'KeepAlive' | 'ParkingInfo' | ...). */
  externalEventType: string;

  /** Canonical event type — see CanonicalCameraEventType. */
  eventType: CanonicalCameraEventType;

  /**
   * Stall/space identifier in the provider's own vocabulary (Dahua:
   * ParkingStallsNo). Never the internal ParkingSpace UUID — the mapping
   * between this code and a real ParkingSpace is a separate concern
   * (CameraStallMapping, see docs/architecture/iot-device-management-foundation.md §9).
   */
  externalStallCode?: string;

  /**
   * Canonical occupancy status — required, defaults to 'UNKNOWN' for event
   * types that carry no occupancy information (e.g. DEVICE_HANDSHAKE,
   * HEARTBEAT). Never a manufacturer-specific code or word.
   */
  parkingStatus: CanonicalParkingStatus;

  /** When the event occurred, already normalized to a concrete Date. */
  occurredAt: Date;

  channel?: number;
  plate?: CanonicalCameraEventPlate;
  vehicle?: CanonicalCameraEventVehicle;

  /**
   * Evidence metadata (image dimensions, kind, etc.) — never decoded
   * image content. Kept as a loose bag because its shape depends on what
   * each provider is able to report.
   */
  evidenceMetadata?: Record<string, unknown>;

  /** FK to the CameraEventRaw row this canonical event was derived from. */
  rawEventId: string;

  /**
   * Provider-specific data that doesn't map to a canonical field above
   * (e.g. device identity attributes reported in a handshake: IP, MAC,
   * manufacturer, model). The core may persist these generically without
   * knowing which provider produced them.
   */
  metadata: Record<string, unknown>;

  idempotencyKey: string;
}
