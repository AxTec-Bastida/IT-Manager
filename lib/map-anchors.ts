export type AnchorPathInput = {
  displayPath?: string | null;
  area?: string | null;
  department?: string | null;
  station?: string | null;
  locationLabel?: string | null;
};

export type PercentRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function buildAnchorDisplayPath(anchor: AnchorPathInput) {
  const explicit = clean(anchor.displayPath);
  if (explicit) return explicit;
  const parts = [anchor.area, anchor.department, anchor.station || anchor.locationLabel].map(clean).filter(Boolean);
  return parts.join(" / ") || clean(anchor.locationLabel) || "Location anchor";
}

export function pointToMapPercent(clientX: number, clientY: number, rect: PercentRect) {
  if (rect.width <= 0 || rect.height <= 0) return { x: 50, y: 50 };
  return {
    x: roundPercent(((clientX - rect.left) / rect.width) * 100),
    y: roundPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

function clean(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function roundPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
