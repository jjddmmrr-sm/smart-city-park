import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LIVE_INITIAL, type LiveSpace, type EnforcementCase, ENFORCEMENT } from "./data";

type Ctx = {
  live: LiveSpace[];
  feed: EnforcementCase[];
  tick: number;
};

const SimContext = createContext<Ctx | null>(null);

const PLATES = "ABCDEFGHJKLMNPRSTUVWXYZ";
function randPlate() {
  const l = (n: number) => Array.from({ length: n }, () => PLATES[Math.floor(Math.random() * PLATES.length)]).join("");
  const d = Math.floor(1000 + Math.random() * 9000);
  return l(3) + d;
}

export function SimProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<LiveSpace[]>(LIVE_INITIAL);
  const [feed, setFeed] = useState<EnforcementCase[]>(ENFORCEMENT.slice(0, 80));
  const [tick, setTick] = useState(0);
  const idxRef = useRef(81);

  useEffect(() => {
    const interval = setInterval(() => {
      setLive((prev) => {
        const next = prev.slice();
        // Flip 6-12 random spaces between available/occupied
        const flips = 6 + Math.floor(Math.random() * 7);
        for (let i = 0; i < flips; i++) {
          const idx = Math.floor(Math.random() * next.length);
          const sp = next[idx];
          if (sp.status === "out_of_service" || sp.status === "reserved") continue;
          if (sp.status === "available") {
            next[idx] = {
              ...sp,
              status: "occupied",
              plate: randPlate(),
              since: new Date().toTimeString().slice(0, 5),
            };
          } else if (sp.status === "occupied") {
            next[idx] = { ...sp, status: "available", plate: "", since: "" };
          }
        }
        return next;
      });

      // Maybe push a new alert
      if (Math.random() < 0.5 && idxRef.current < ENFORCEMENT.length) {
        const fresh = ENFORCEMENT[idxRef.current++];
        setFeed((f) => [{ ...fresh, status: "pending", detected: new Date().toTimeString().slice(0, 5) }, ...f].slice(0, 200));
      }
      setTick((t) => t + 1);
    }, 7000);
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
    let occ = 0, av = 0, res = 0, oos = 0;
    for (const s of live) {
      if (s.status === "occupied") occ++;
      else if (s.status === "available") av++;
      else if (s.status === "reserved") res++;
      else oos++;
    }
    const total = live.length;
    return { total, occupied: occ, available: av, reserved: res, oos, occupancy: total ? occ / (total - oos) : 0 };
  }, [live]);
}
