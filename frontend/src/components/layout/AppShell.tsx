"use client";

import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import { SessionProvider } from "@/lib/session-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen">
        <Sidebar />
        <TopBar />
        <main className="ml-[var(--sidebar-width)] pt-[var(--topbar-height)] min-h-screen">
          <div className="p-6 max-w-[1440px]">
            {children}
          </div>
        </main>
      </div>
    </SessionProvider>
  );
}
