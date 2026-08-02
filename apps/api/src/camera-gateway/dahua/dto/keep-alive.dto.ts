import { DahuaEventBaseDto } from './dahua-event-base.dto';

/**
 * KeepAlive carries no fields beyond the common envelope (DeviceID) in the
 * payloads observed against real hardware — see
 * smartpark-dahua-reference/docs/payloads-reales.md.
 */
export class KeepAliveDto extends DahuaEventBaseDto {}
