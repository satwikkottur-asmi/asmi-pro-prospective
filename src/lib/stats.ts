import { useQuery } from "@tanstack/react-query";
import { CITY_SPOTS, type CityKey, MIN_COUNT_TO_SHOW } from "@/config";
import { getStats } from "./api";
import type { Stats } from "./api-types";

// Public waitlist counts from the backend; UI hides them until thresholds are met.
export type { Stats };

export function useStats() {
  return useQuery<Stats>({
    queryKey: ["stats"],
    queryFn: getStats,
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
