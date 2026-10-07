import { useQuery } from "@tanstack/react-query";
import { CITY_SPOTS, type CityKey, MIN_COUNT_TO_SHOW, RECENT_MIN } from "@/config";
import { getStats } from "./api";

// Public waitlist counts from the backend; UI hides them until thresholds are met.
export type Stats = {
  total: number;
  remaining: number;
  cities: Record<CityKey, number>;
  recent7d: number;
  recent: { trade: string | null; place: string; when: "today" | "yesterday" | "this week" }[];
};

export function useStats() {
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: () => getStats<Stats>(),
    staleTime: 60_000,
    retry: false, // the API client already retries
  });
}

export function spotsLeft(stats: Stats | undefined, city: CityKey | null): number | null {
  if (!stats || !city || city === "other") return null;
  const cap = CITY_SPOTS[city];
  if (cap == null) return null;
  return Math.max(0, cap - (stats.cities[city] ?? 0));
}

export const showCounts = (s?: Stats) => !!s && s.total >= MIN_COUNT_TO_SHOW;
export const showRecent = (s?: Stats) =>
  showCounts(s) && s!.recent7d >= RECENT_MIN && s!.recent.length > 0;
