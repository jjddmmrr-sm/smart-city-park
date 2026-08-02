export type DahuaDetectionScope = 'PARKING_SPACE' | 'ILLEGAL_AREA';

export type DahuaOccupancyStatus =
  | 'OCCUPIED'
  | 'FREE'
  | 'UNKNOWN'
  | 'ILLEGAL'
  | 'DETECTION';

export type CameraSnapshotKind = 'PANORAMIC' | 'VEHICLE' | 'PLATE' | 'COMBINED';

export interface CameraParkingEventPlate {
  exists: boolean;
  number?: string;
  confidence?: number;
  color?: string;
  region?: string;
}

export interface CameraParkingEventVehicle {
  type?: string;
  color?: string;
  brand?: string;
}

export interface CameraParkingEventImage {
  kind: CameraSnapshotKind;
  width?: number;
  height?: number;
  contentBase64?: string;
}

/**
 * Canonical internal event contract — see DAHUA_IMPLEMENTATION_PLAN.md §3.
 * tenantId/cityId are always resolved server-side from Camera.deviceId,
 * never accepted from the incoming payload.
 */
export interface CameraParkingEvent {
  source: 'DAHUA_ITSAPI';
  tenantId: string;
  cityId: string;
  cameraId: string;
  deviceId: string;
  detectionScope: DahuaDetectionScope;
  parkingSpaceCode?: string;
  occupancyStatus?: DahuaOccupancyStatus;
  illegalAreaName?: string;
  detectedAt?: string;
  plate?: CameraParkingEventPlate;
  vehicle?: CameraParkingEventVehicle;
  images?: CameraParkingEventImage[];
  idempotencyKey: string;
  rawEventId: string;
  channel?: number;
  timezoneOffset?: number;
  allowedUser?: boolean;
  entryRecordId?: string;
}
