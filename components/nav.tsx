"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Activity, AlertTriangle, ClipboardCheck, Database, LayoutDashboard, ListChecks, Map, MapPinned, MoreHorizontal, Package, Radar, ReceiptText, Router, ScanLine, SearchX, Settings, Users, Warehouse } from "lucide-react";
import { clsx } from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Inventory", icon: Database },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/jobs", label: "Jobs", icon: ListChecks },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/facturas", label: "Facturas", icon: ReceiptText },
  { href: "/assignments", label: "Assignments", icon: ClipboardCheck },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/map", label: "Map", icon: Map },
  { href: "/zones", label: "Zones", icon: MapPinned },
  { href: "/missing", label: "Missing", icon: SearchX },
  { href: "/ranges", label: "Ranges", icon: Router },
  { href: "/scanner", label: "Scanner", icon: Radar },
  { href: "/conflicts", label: "Conflicts", icon: AlertTriangle },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav({ siteName }: { siteName: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileLinks = ["/dashboard", "/scan", "/devices", "/alerts"].map((href) => links.find((link) => link.href === href)!);
  const moreLinks = links.filter((link) => !mobileLinks.some((mobileLink) => mobileLink.href === link.href));
  const moreActive = moreLinks.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Warehouse size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{siteName}</p>
              <p className="text-xs text-slate-500">Inventory Tracker</p>
            </div>
          </div>
          <Link
            href="/scan"
            className={clsx(
              "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              pathname === "/scan" ? "bg-emerald-700 text-white" : "bg-slate-950 text-white",
            )}
          >
            <ScanLine size={17} />
            Scan
          </Link>
        </div>
      </header>

      <aside className="hidden border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Warehouse size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{siteName}</p>
            <p className="text-xs text-slate-500">IT Inventory</p>
          </div>
        </div>
        <nav className="space-y-1 overflow-y-auto px-2 pb-3">
          {links.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium",
                  active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                )}
              >
                <Icon size={16} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {moreOpen ? (
        <div id="mobile-more-menu" className="fixed inset-x-3 bottom-20 z-40 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-950">More tools</p>
            <button type="button" onClick={() => setMoreOpen(false)} className="min-h-11 rounded-md px-3 text-sm font-semibold text-slate-600">Close</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {moreLinks.map((link) => {
              const Icon = link.icon;
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={clsx(
                    "flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold",
                    active ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <Icon size={17} />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold",
                  active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon size={19} />
                {link.href === "/dashboard" ? "Home" : link.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={clsx(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold",
              moreOpen || moreActive ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
            aria-expanded={moreOpen}
            aria-controls="mobile-more-menu"
          >
            <MoreHorizontal size={19} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
