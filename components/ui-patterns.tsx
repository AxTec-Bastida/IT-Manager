import Link from "next/link";
import { clsx } from "clsx";

export type ActionVariant = "primary" | "secondary" | "subtle" | "danger" | "warning" | "success" | "ghost";

export function actionButtonClass(variant: ActionVariant = "secondary", className?: string) {
  return clsx(
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary"
      ? "bg-slate-950 text-white hover:bg-slate-800"
      : variant === "danger"
        ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 focus-visible:outline-rose-900"
        : variant === "warning"
          ? "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 focus-visible:outline-amber-900"
          : variant === "success"
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus-visible:outline-emerald-900"
            : variant === "subtle"
              ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
              : variant === "ghost"
                ? "text-slate-700 hover:bg-slate-100"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
    className,
  );
}

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>{children}</section>;
}

export function MobileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <article className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>{children}</article>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm shadow-slate-200/60">
      <p className="font-semibold text-slate-950">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end", className)}>{children}</div>;
}

export function ActionLink({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ActionVariant;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={actionButtonClass(variant, className)}
    >
      {children}
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  className,
}: {
  label: string;
  value: string | number;
  helper?: string;
  className?: string;
}) {
  return (
    <div className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>
      <p className="text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function AlertPanel({
  title,
  children,
  tone = "info",
  className,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "info" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-950"
          : "border-sky-200 bg-sky-50 text-sky-950";
  return (
    <div className={clsx("rounded-lg border p-4", toneClass, className)} role={tone === "danger" ? "alert" : "status"}>
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

export function BottomActionBar({ children }: { children: React.ReactNode }) {
  return (
    <nav className="fixed inset-x-3 bottom-24 z-30 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
      {children}
    </nav>
  );
}
