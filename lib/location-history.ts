export type LocationLike = {
  id: string;
  assetId: string;
  seenAt: Date;
};

export function getLastKnownLocation<T extends LocationLike>(history: T[]): T | null {
  return [...history].sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime())[0] ?? null;
}

export function getLastFiveLocations<T extends LocationLike>(history: T[]): T[] {
  return [...history].sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime()).slice(0, 5);
}
