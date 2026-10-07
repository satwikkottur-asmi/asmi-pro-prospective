// Launch config. Only turn on what is true today. Empty or false hides the block.

// Keys stored in the database (language independent). Labels live in src/lib/dict.ts.
export const CITY_KEYS = ["bay_area", "los_angeles", "new_york", "other"] as const;
export const LAUNCH_CITIES = ["bay_area", "los_angeles", "new_york"] as const;
export const TRADE_KEYS = [
  "plumbing",
  "electrical",
  "hvac",
  "handyman",
  "roofing",
  "general_contractor",
  "cleaning",
  "other",
] as const;
export const CREW_KEYS = ["just_me", "2_5", "6_10", "10_plus"] as const;

export type CityKey = (typeof CITY_KEYS)[number];
export type LaunchCity = (typeof LAUNCH_CITIES)[number];
export type TradeKey = (typeof TRADE_KEYS)[number];
export type CrewKey = (typeof CREW_KEYS)[number];

export const BRAND = "Hoys"; // rendered for `{brand}` in dict.ts copy
export const SUPPORT_EMAIL = "support@hoys.ai";
export const SUPPORT_TEXT_NUMBER = ""; // US number pros can text; hidden when empty
export const CITY_SPOTS: Record<LaunchCity, number | null> = {
  bay_area: null,
  los_angeles: null,
  new_york: null,
}; // real founding caps
export const MIN_COUNT_TO_SHOW = 100;
export const REFERRAL_BUMP = 0;
export const COMMISSION_START_PERCENT = 15;
export const NEXT_STEPS_TIMING = "";
export const CREW_FREE = false;
export const SHOW_FOUNDER_PHOTOS = true;
export const HAS_PRO_QUOTE = false;
export const PRO_QUOTE = { text: "", name: "", trade: "", city: "" };

// Public site URL used in share links. Falls back to the current origin.
export const SITE_URL = "";
