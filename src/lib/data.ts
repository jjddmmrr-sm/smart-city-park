import zones from "@/data/zones.json";
import spaces from "@/data/spaces.json";
import liveRaw from "@/data/live.json";
import vehicles from "@/data/vehicles.json";
import enforcement from "@/data/enforcement.json";
import daily from "@/data/daily.json";
import hourly from "@/data/hourly.json";
import txAgg from "@/data/transactions_agg.json";

export type Zone = {
  zone_id: string; zone_name: string; spaces: number; tariff: number;
  occupancy_base: number; streets: string[];
};
export type Space = {
  id: string; zone_id: string; zone: string; street: string;
  lat: number; lng: number; type: string; sensor: boolean; tariff: number;
};
export type LiveSpace = {
  id: string; zone_id: string; zone: string; street: string;
  lat: number; lng: number;
  status: "available" | "occupied" | "reserved" | "out_of_service";
  type: string; sensor: boolean; plate: string; since: string;
};
export type Vehicle = {
  id: string; date: string; plate: string; brand: string; model: string;
  color: string; type: string; zone_id: string; zone: string; street: string;
  start: string; end: string; duration: number;
  payment: "paid" | "partial" | "unpaid"; compliance: "valid" | "overstay" | "no_payment";
};
export type EnforcementCase = {
  id: string; date: string; plate: string; zone_id: string; zone: string;
  street: string; issue: "overstay" | "no_payment"; detected: string;
  status: "pending" | "reviewing" | "resolved" | "fined";
  priority: "low" | "medium" | "high";
};
export type DailyMetric = {
  date: string; zone_id: string; zone_name: string; total_vehicles: number;
  avg_duration_minutes: number; occupancy_rate: number; revenue_usd: number;
  overstay_cases: number; unpaid_cases: number;
};
export type HourlyAvg = {
  zone_id: string; zone_name: string; hour: number;
  occupancy_rate: number; avg_entries: number;
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

export const ZONE_BY_ID = Object.fromEntries(ZONES.map((z) => [z.zone_id, z]));

export const LATEST_DATE = DAILY.reduce((a, b) => (a.date > b.date ? a : b)).date;
