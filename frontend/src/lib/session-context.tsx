"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { sessions as sessionsApi } from "./api-client";
import type { Session } from "./types";

interface SessionContextValue {
  sessions: Session[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  loading: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = "ctt-active-session";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) setActiveSessionIdState(stored);

    sessionsApi.list()
      .then((list) => {
        setSessions(list);
        if (!stored && list.length > 0) {
          const id = list[0].id;
          setActiveSessionIdState(id);
          localStorage.setItem(STORAGE_KEY, id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveSessionId = (id: string | null) => {
    setActiveSessionIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <SessionContext.Provider value={{ sessions, activeSessionId, setActiveSessionId, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
