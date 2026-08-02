import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { apiGetAuth } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { KpiTile } from "@/components/ui-bits";
import { IotPageShell } from "@/components/iot/IotSideNav";
import { Camera, CameraOff, Router, Server, SquareParking, Radio, Clock, Bell } from "lucide-react";

export const Route = createFileRoute("/admin/iot/")({
  component: IotDashboardPage,
  ssr: false,
});

type DashboardData = {
  camerasOnline: number;
  camerasOffline: number;
  gatewaysCount: number;
  providersCount: number;
  spacesCount: number;
  eventsLast24h: number;
  lastKeepAliveAt: string | null;
  alertsOpen: number;
};

function IotDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate({ to: "/admin/login" });
      return;
    }
    apiGetAuth<DashboardData>("/iot-device-management/dashboard")
      .then(setData)
      .catch((error) => console.error("Error loading IoT dashboard", error));
  }, [navigate]);

  return (
    <IotPageShell
      title="IoT Device Management"
      description="Estado general del parque de cámaras y gateways conectados."
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Cámaras Online"
          value={data?.camerasOnline ?? "—"}
          accent="success"
          icon={<Camera className="h-4 w-4" />}
        />
        <KpiTile
          label="Cámaras Offline"
          value={data?.camerasOffline ?? "—"}
          accent="destructive"
          icon={<CameraOff className="h-4 w-4" />}
        />
        <KpiTile
          label="Gateways"
          value={data?.gatewaysCount ?? "—"}
          accent="primary"
          icon={<Router className="h-4 w-4" />}
        />
        <KpiTile
          label="Providers"
          value={data?.providersCount ?? "—"}
          accent="primary"
          icon={<Server className="h-4 w-4" />}
        />
        <KpiTile
          label="Plazas"
          value={data?.spacesCount ?? "—"}
          accent="accent"
          icon={<SquareParking className="h-4 w-4" />}
        />
        <KpiTile
          label="Eventos (24h)"
          value={data?.eventsLast24h ?? "—"}
          accent="accent"
          icon={<Radio className="h-4 w-4" />}
        />
        <KpiTile
          label="Último KeepAlive"
          value={
            data?.lastKeepAliveAt ? new Date(data.lastKeepAliveAt).toLocaleTimeString("es-EC") : "—"
          }
          sub={
            data?.lastKeepAliveAt
              ? new Date(data.lastKeepAliveAt).toLocaleDateString("es-EC")
              : undefined
          }
          accent="warning"
          icon={<Clock className="h-4 w-4" />}
        />
        <KpiTile
          label="Alertas"
          value={data?.alertsOpen ?? "—"}
          accent="warning"
          icon={<Bell className="h-4 w-4" />}
        />
      </div>
    </IotPageShell>
  );
}
