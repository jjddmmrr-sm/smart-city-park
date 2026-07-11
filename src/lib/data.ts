import zones from "@/data/zones.json";
import spaces from "@/data/spaces.json";
import liveRaw from "@/data/live.json";
import vehicles from "@/data/vehicles.json";
import enforcement from "@/data/enforcement.json";
import daily from "@/data/daily.json";
import hourly from "@/data/hourly.json";
import txAgg from "@/data/transactions_agg.json";
import multas from "@/data/multas.json";
import multasResumen from "@/data/multas_resumen.json";
import controladores from "@/data/controladores.json";
import controladoresProd from "@/data/controladores_productividad.json";
import mediosPago from "@/data/medios_pago.json";

export type Zone = {
  zone_id: string;
  zone_name: string;
  spaces: number;
  tariff: number;
  occupancy_base: number;
  streets: string[];
};
export type Space = {
  id: string;
  zone_id: string;
  zone: string;
  street: string;
  lat: number;
  lng: number;
  type: string;
  sensor: boolean;
  tariff: number;
};
export type LiveSpace = {
  id: string;
  zone_id: string;
  zone: string;
  street: string;
  lat: number;
  lng: number;
  status: "available" | "occupied" | "reserved" | "out_of_service";
  type: string;
  sensor: boolean;
  plate: string;
  since: string;
};
export type Vehicle = {
  id: string;
  date: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  type: string;
  zone_id: string;
  zone: string;
  street: string;
  start: string;
  end: string;
  duration: number;
  payment: "paid" | "partial" | "unpaid";
  compliance: "valid" | "overstay" | "no_payment";
};
export type EnforcementCase = {
  id: string;
  date: string;
  plate: string;
  zone_id: string;
  zone: string;
  street: string;
  issue: "overstay" | "no_payment";
  detected: string;
  status: "pending" | "reviewing" | "resolved" | "fined";
  priority: "low" | "medium" | "high";
};
export type DailyMetric = {
  date: string;
  zone_id: string;
  zone_name: string;
  total_vehicles: number;
  avg_duration_minutes: number;
  occupancy_rate: number;
  revenue_usd: number;
  overstay_cases: number;
  unpaid_cases: number;
};
export type HourlyAvg = {
  zone_id: string;
  zone_name: string;
  hour: number;
  occupancy_rate: number;
  avg_entries: number;
};

export type Multa = {
  multa_id: string;
  fecha_hora: string;
  placa: string;
  zona: string;
  calle: string;
  motivo_codigo: "sin_pago" | "exceso_tiempo" | "zona_prohibida" | "zona_reservada";
  motivo_descripcion: string;
  valor_multa_usd: number;
  controlador_id: string;
  evidencia_foto: "si" | "no";
  estado_multa: "pendiente" | "pagada" | "apelada" | "notificada" | "anulada";
  prioridad: "alta" | "media" | "baja";
  observacion: string;
};
export type MultaResumen = {
  fecha: string;
  zona: string;
  multas_sin_pago: number;
  multas_exceso_tiempo: number;
  multas_zona_prohibida: number;
  multas_zona_reservada: number;
  total_multas: number;
  monto_total_usd: number;
};
export type Controlador = {
  controlador_id: string;
  nombre: string;
  zona_asignada: string;
  turno: "mañana" | "tarde" | "mixto";
  estado: "activo" | "vacaciones" | "inactivo";
  fecha_ingreso: string;
  dispositivo_id: string;
};
export type ControladorProd = {
  fecha: string;
  controlador_id: string;
  zona: string;
  inspecciones_realizadas: number;
  vehiculos_validados: number;
  alertas_emitidas: number;
  multas_generadas: number;
  tiempo_promedio_respuesta_min: number;
  porcentaje_casos_cerrados: number;
  recorrido_km: number;
  turno: string;
};
export type MedioPago = {
  fecha: string;
  zona: string;
  metodo_pago_codigo: "app_movil" | "tarjeta_fisica" | "kiosco" | "agente";
  metodo_pago_descripcion: string;
  transacciones: number;
  monto_total_usd: number;
  tickets_promedio_usd: number;
  porcentaje_participacion: number;
};

export const ZONES = zones as Zone[];
export const SPACES = spaces as Space[];
export const LIVE_INITIAL = liveRaw as unknown as LiveSpace[];
export const VEHICLES = vehicles as unknown as Vehicle[];
export const ENFORCEMENT = enforcement as unknown as EnforcementCase[];
export const DAILY = daily as DailyMetric[];
export const HOURLY = hourly as HourlyAvg[];
export const TX_AGG = txAgg as {
  by_day_zone: { date: string; zone_id: string; zone: string; amount: number }[];
  by_method: { method: string; amount: number }[];
};
export const MULTAS = multas as unknown as Multa[];
export const MULTAS_RESUMEN = multasResumen as unknown as MultaResumen[];
export const CONTROLADORES = controladores as unknown as Controlador[];
export const CONTROLADORES_PROD = controladoresProd as unknown as ControladorProd[];
export const MEDIOS_PAGO = mediosPago as unknown as MedioPago[];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.zone_id, z]));
export const CONTROLADOR_BY_ID = Object.fromEntries(
  CONTROLADORES.map((c) => [c.controlador_id, c]),
);

export const LATEST_DATE = DAILY.reduce((a, b) => (a.date > b.date ? a : b)).date;
