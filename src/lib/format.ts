export const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));
export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export const fmtUSD2 = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
export const fmtPct = (n: number, d = 0) => `${(n * 100).toFixed(d)}%`;

export const STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  occupied: "#ef4444",
  reserved: "#f59e0b",
  out_of_service: "#94a3b8",
};

export const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  occupied: "Occupied",
  reserved: "Reserved",
  out_of_service: "Out of service",
};
