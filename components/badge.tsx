import { clsx } from "clsx";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "pending"
  | "offline"
  | "synced"
  | "conflict"
  | "admin"
  | "security"
  | "maintenance"
  | "inventory";

export const badgeToneClass: Record<BadgeTone, string> = {
  neutral: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] ring-[var(--status-neutral-ring)]",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-[var(--status-success-ring)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-[var(--status-warning-ring)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] ring-[var(--status-danger-ring)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)] ring-[var(--status-info-ring)]",
  pending: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] ring-[var(--status-warning-ring)]",
  offline: "bg-[var(--status-offline-bg)] text-[var(--status-offline-text)] ring-[var(--status-offline-ring)]",
  synced: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] ring-[var(--status-success-ring)]",
  conflict: "bg-[var(--status-conflict-bg)] text-[var(--status-conflict-text)] ring-[var(--status-conflict-ring)]",
  admin: "bg-[var(--status-admin-bg)] text-[var(--status-admin-text)] ring-[var(--status-admin-ring)]",
  security: "bg-[var(--status-admin-bg)] text-[var(--status-admin-text)] ring-[var(--status-admin-ring)]",
  maintenance: "bg-[var(--status-maintenance-bg)] text-[var(--status-maintenance-text)] ring-[var(--status-maintenance-ring)]",
  inventory: "bg-[var(--status-inventory-bg)] text-[var(--status-inventory-text)] ring-[var(--status-inventory-ring)]",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={clsx("status-badge max-w-full break-words", badgeToneClass[tone], className)}>
      {children}
    </span>
  );
}
