"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session-context";

const staticItems = [
  { href: "/", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
];

const sessionItems = [
  { suffix: "/ingest", label: "Ingest", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
  { suffix: "/test-cases", label: "Test Cases", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { suffix: "/approval", label: "Approve", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { suffix: "/run", label: "Run", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" },
  { suffix: "/reports/summary", label: "Reports", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
];

const bottomItems = [
  { href: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

function NavItem({ href, label, icon, active, dimmed }: { href: string; label: string; icon: string; active: boolean; dimmed?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        dimmed
          ? "text-on-surface-variant/40 pointer-events-none"
          : active
            ? "bg-primary-light text-primary"
            : "text-on-surface-variant hover:bg-surface-dim"
      }`}
    >
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { activeSessionId } = useSession();

  const hasSession = !!activeSessionId;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[var(--sidebar-width)] bg-surface border-r border-border-light flex flex-col z-30">
      <div className="h-[var(--topbar-height)] flex items-center px-5 border-b border-border-light">
        <span className="font-display font-bold text-lg text-primary">CTT</span>
        <span className="ml-2 text-xs text-on-surface-variant">Testing Platform</span>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {staticItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href}
          />
        ))}

        {hasSession && <div className="my-2 border-t border-border-light" />}

        {sessionItems.map((item) => {
          const href = `/sessions/${activeSessionId}${item.suffix}`;
          const isActive = pathname === href || pathname.startsWith(`/sessions/${activeSessionId}${item.suffix}`);
          return (
            <NavItem
              key={item.suffix}
              href={hasSession ? href : "/"}
              label={item.label}
              icon={item.icon}
              active={isActive}
              dimmed={!hasSession}
            />
          );
        })}
      </nav>

      <nav className="py-3 px-3 space-y-0.5 border-t border-border-light">
        {bottomItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname === item.href || pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-border-light text-xs text-on-surface-variant">
        v0.1.0
      </div>
    </aside>
  );
}
