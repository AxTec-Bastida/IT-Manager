import Link from "next/link";
import { clsx } from "clsx";

export type ActionVariant = "primary" | "secondary" | "subtle" | "danger" | "warning" | "success" | "ghost";

export function actionButtonClass(variant: ActionVariant = "secondary", className?: string) {
  return clsx(
    "inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-4 text-center text-sm font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:shrink-0",
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

export function PolishedCard({
  title,
  description,
  eyebrow,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>
      {title || description || eyebrow || action ? (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{eyebrow}</p> : null}
            {title ? <h2 className="mt-1 break-words text-lg font-semibold text-slate-950">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p> : null}
          </div>
          {action ? <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:justify-end [&_a]:w-full [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto">{action}</div> : null}
        </div>
      ) : null}
      {children ? <div className={clsx(title || description || eyebrow || action ? "mt-4" : undefined)}>{children}</div> : null}
    </section>
  );
}

export function ActionGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={clsx("grid min-w-0 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap", className)}>{children}</div>;
}

export function KeyValueGrid({
  items,
  className,
}: {
  items: Array<{ label: string; value: React.ReactNode; helper?: React.ReactNode }>;
  className?: string;
}) {
  return (
    <dl className={clsx("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-950">{item.value}</dd>
          {item.helper ? <dd className="mt-1 break-words text-xs text-slate-500">{item.helper}</dd> : null}
        </div>
      ))}
    </dl>
  );
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
  return <div className={clsx("grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end", className)}>{children}</div>;
}

export function ActionLink({
  href,
  children,
  variant = "secondary",
  className,
  target,
}: {
  href: string;
  children: React.ReactNode;
  variant?: ActionVariant;
  className?: string;
  target?: string;
}) {
  return (
    <Link
      href={href}
      className={actionButtonClass(variant, className)}
      target={target}
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
