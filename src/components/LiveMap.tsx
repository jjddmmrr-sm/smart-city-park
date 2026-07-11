import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet.heat";
import { useSim } from "@/lib/sim";
import type { LiveSpace } from "@/lib/data";

// Fix default marker icons (not used, but suppresses leaflet warnings)
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;

const STATUS_FILL: Record<string, string> = {
  available: "#10b981",
  occupied: "#ef4444",
  reserved: "#f59e0b",
  out_of_service: "#94a3b8",
};

export function LiveMap({
  filter,
  heat,
  onSelect,
  selectedId,
  liveData,
}: {
  filter: { zone: string; status: string };
  heat: boolean;
  onSelect: (s: LiveSpace) => void;
  selectedId: string | null;
  liveData?: LiveSpace[];
}) {
  const { live: simulatedLive } = useSim();
  const live = liveData ?? simulatedLive;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const [ready, setReady] = useState(false);

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [-0.6985, -80.0995],
      zoom: 16,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setReady(true);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const filtered = useMemo(() => {
    return live.filter(
      (s) =>
        (filter.zone === "all" || s.zone_id === filter.zone) &&
        (filter.status === "all" || s.status === filter.status),
    );
  }, [live, filter]);

  // render markers
  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    const layer = layerRef.current;
    layer.clearLayers();

    if (heat) {
      const points = filtered
        .filter((s) => s.status === "occupied")
        .map((s) => [s.lat, s.lng, 0.6] as [number, number, number]);
      const heatLayer = (
        L as unknown as { heatLayer: (p: unknown, o: unknown) => L.Layer }
      ).heatLayer(points, {
        radius: 28,
        blur: 22,
        maxZoom: 18,
        gradient: { 0.2: "#00d4aa", 0.5: "#f59e0b", 0.8: "#ef4444" },
      });
      heatLayer.addTo(layer);
      heatRef.current = heatLayer;
      return;
    }

    for (const s of filtered) {
      const isSel = s.id === selectedId;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isSel ? 7 : 4.5,
        weight: isSel ? 2 : 1,
        color: isSel ? "#0a2540" : "#ffffff",
        fillColor: STATUS_FILL[s.status] ?? "#94a3b8",
        fillOpacity: 0.95,
      });
      marker.on("click", () => onSelect(s));
      marker.addTo(layer);
    }
  }, [filtered, heat, ready, onSelect, selectedId]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
