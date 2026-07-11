import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { LiveSpace, EnforcementCase } from "./data";
import { apiGet } from "./api";

type Ctx = {
  live: LiveSpace[];
  feed: EnforcementCase[];
  tick: number;
};

const SimContext = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<LiveSpace[]>([]);
  const [feed, setFeed] = useState<EnforcementCase[]>([]);
  const [tick, setTick] = useState(0);

  async function loadData() {
    try {
      const [liveData, enforcementData] = await Promise.all([
        apiGet<LiveSpace[]>("/frontend/live"),
        apiGet<EnforcementCase[]>("/frontend/enforcement"),
      ]);

      setLive(liveData);
      setFeed(enforcementData);
      setTick((t) => t + 1);
    } catch (error) {
      console.error("Error loading live data", error);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const value = useMemo(() => ({ live, feed, tick }), [live, feed, tick]);

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error("useSim must be inside SimProvider");
  return ctx;
}

export function useLiveStats() {
  const { live } = useSim();

  return useMemo(() => {
    let occ = 0;
    let av = 0;
    let res = 0;
    let oos = 0;

    for (const s of live) {
      if (s.status === "occupied") occ++;
      else if (s.status === "available") av++;
      else if (s.status === "reserved") res++;
      else oos++;
    }

    const total = live.length;

    return {
      total,
      occupied: occ,
      available: av,
      reserved: res,
      oos,
      occupancy: total ? occ / Math.max(total - oos, 1) : 0,
    };
  }, [live]);
}
