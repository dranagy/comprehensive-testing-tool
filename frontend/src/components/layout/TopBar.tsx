"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-context";

export default function TopBar() {
  const router = useRouter();
  const { sessions, activeSessionId, setActiveSessionId, loading } = useSession();

  return (
    <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-[var(--topbar-height)] bg-surface border-b border-border-light flex items-center px-6 z-20">
      <div className="flex items-center gap-4 flex-1">
        <select
          value={activeSessionId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            setActiveSessionId(id || null);
            if (id) router.push(`/sessions/${id}`);
          }}
          disabled={loading}
          className="text-sm bg-surface-dim border border-border rounded-md px-3 py-1.5 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="" disabled>
            {loading ? "Loading..." : "Select session..."}
          </option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.status}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
