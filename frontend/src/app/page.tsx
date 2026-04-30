"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import { sessions as sessionsApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import type { Session } from "@/lib/types";

export default function DashboardPage() {
  const [sessionList, setSessionList] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    sessionsApi.list()
      .then(setSessionList)
      .catch((err) => showToast(err instanceof Error ? err.message : "Failed to load sessions", "error"))
      .finally(() => setLoading(false));
  }, []);

  const totalSessions = sessionList.length;
  const activeSessions = sessionList.filter((s) => s.status !== "COMPLETE").length;
  const lastSession = sessionList[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-foreground">Dashboard</h1>
        <Link href="/sessions/new">
          <Button>+ New Session</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Sessions" value={totalSessions} icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        <StatCard label="Active Sessions" value={activeSessions} icon="M13 10V3L4 14h7v7l9-11h-7z" />
        <StatCard
          label="Last Run Pass Rate"
          value={lastSession?.executionSummary?.total ? `${((lastSession.executionSummary.passed / lastSession.executionSummary.total) * 100).toFixed(1)}%` : "—"}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </div>

      <div className="bg-surface rounded-lg border border-border-light">
        <div className="px-4 py-3 border-b border-border-light">
          <h2 className="font-display font-semibold text-sm text-foreground">Sessions</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">Loading...</div>
        ) : sessionList.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            No sessions yet. Create your first session to get started.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs text-on-surface-variant uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Target URL</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {sessionList.map((session) => (
                <tr key={session.id} className="border-t border-border-light hover:bg-surface-dim transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/sessions/${session.id}`} className="text-sm font-medium text-primary hover:underline">
                      {session.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{session.targetUrl}</td>
                  <td className="px-4 py-3"><StatusBadge status={session.status} /></td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{new Date(session.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
