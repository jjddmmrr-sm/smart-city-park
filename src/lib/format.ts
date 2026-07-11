export const fmtInt = (n: number) => new Intl.NumberFormat("es-EC").format(Math.round(n));
export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
export const fmtUSD2 = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
export const fmtPct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

export const STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  occupied: "#ef4444",
  reserved: "#f59e0b",
  out_of_service: "#94a3b8",
};

export const STATUS_LABEL: Record<string, string> = {
  available: "Disponible",
  occupied: "Ocupado",
  reserved: "Reservado",
  out_of_service: "Fuera de servicio",
  paid: "Pagado",
  unpaid: "No pagado",
  partial: "Parcial",
  valid: "Válido",
  overstay: "Exceso de tiempo",
  no_payment: "Sin pago",
  pending: "Pendiente",
  reviewing: "En revisión",
  resolved: "Resuelto",
  fined: "Multado",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  pagada: "Pagada",
  apelada: "Apelada",
  notificada: "Notificada",
  anulada: "Anulada",
  pendiente: "Pendiente",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  activo: "Activo",
  vacaciones: "Vacaciones",
  inactivo: "Inactivo",
};

export const ISSUE_LABEL: Record<string, string> = {
  overstay: "Exceso de tiempo",
  no_payment: "Sin pago",
  zona_prohibida: "Zona prohibida",
  zona_reservada: "Zona reservada",
  exceso_tiempo: "Exceso de tiempo",
  sin_pago: "Sin pago",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  app_movil: "Aplicación móvil",
  tarjeta_fisica: "Tarjeta física",
  kiosco: "Kiosco",
  agente: "Agente en sitio",
};
