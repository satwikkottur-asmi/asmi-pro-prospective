import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CityKey } from "@/config";
import { postEvent } from "./api";
import { type Dict, dicts, type Lang, type Variant } from "./dict";

type Ctx = {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  variant: Variant;
  city: CityKey | null;
  setCity: (c: CityKey) => void;
  sheetOpen: boolean;
  openSheet: (source: string) => void;
  closeSheet: () => void;
};

const AppCtx = createContext<Ctx | null>(null);

const CITY_PARAM: Record<string, CityKey> = {
  sf: "bay_area",
  bay: "bay_area",
  la: "los_angeles",
  ny: "new_york",
  nyc: "new_york",
};

export function resolveVariant(v?: string, src?: string): Variant {
  if (v === "a" || v === "b" || v === "c") return v;
  if (src === "fb") return "c";
  if (src === "door") return "b";
  return "a";
}

function getSessionId() {
  let id = sessionStorage.getItem("asmi_sid");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("asmi_sid", id);
  }
  return id;
}

// First-touch attribution captured on landing and sent with the stage-1 signup.
const ATTR_KEYS = [
  "src",
  "v",
  "city",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type Attribution = Partial<Record<(typeof ATTR_KEYS)[number] | "referrer", string>>;

export function getAttribution(): Attribution {
  try {
    return JSON.parse(sessionStorage.getItem("asmi_attr") || "{}");
  } catch {
    return {};
  }
}

let ctxSnapshot = { variant: "a" as Variant, lang: "en" as Lang };

export function track(name: string, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const attr = getAttribution();
    postEvent({
      stage: "event",
      name,
      session_id: getSessionId(),
      variant: ctxSnapshot.variant,
      src: attr.src || null,
      lang: ctxSnapshot.lang,
      meta,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export function AppProvider({
  children,
  search,
}: {
  children: ReactNode;
  search: {
    v?: string | undefined;
    src?: string | undefined;
    lang?: string | undefined;
    city?: string | undefined;
  };
}) {
  const variant = resolveVariant(search.v, search.src);
  const [lang, setLangState] = useState<Lang>(search.lang === "es" ? "es" : "en");
  const [city, setCityState] = useState<CityKey | null>(
    search.city ? (CITY_PARAM[search.city] ?? null) : null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    // Attribution: keep first-touch params for this session.
    const p = new URLSearchParams(window.location.search);
    if (!sessionStorage.getItem("asmi_attr")) {
      const a: Attribution = {};
      for (const k of ATTR_KEYS) {
        const val = p.get(k);
        if (val) a[k] = val.slice(0, 100);
      }
      if (document.referrer) a.referrer = document.referrer.slice(0, 300);
      sessionStorage.setItem("asmi_attr", JSON.stringify(a));
    }
    const stored = localStorage.getItem("asmi_lang") as Lang | null;
    const initial: Lang =
      p.get("lang") === "es"
        ? "es"
        : (stored ?? (navigator.language?.toLowerCase().startsWith("es") ? "es" : "en"));
    setLangState(initial);
    if (!city) {
      const sc = sessionStorage.getItem("asmi_city") as CityKey | null;
      if (sc) setCityState(sc);
    } else sessionStorage.setItem("asmi_city", city);
    ctxSnapshot = { variant, lang: initial };
    track("page_view", { path: window.location.pathname });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = dicts[lang].meta.title;
    ctxSnapshot = { variant, lang };
  }, [lang, variant]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("asmi_lang", l);
    track("lang_switch", { to: l });
  }, []);
  const setCity = useCallback((c: CityKey) => {
    setCityState(c);
    sessionStorage.setItem("asmi_city", c);
  }, []);
  const openSheet = useCallback((source: string) => {
    track("cta_click", { source });
    track("sheet_open", { source });
    setSheetOpen(true);
  }, []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const value = useMemo(
    () => ({
      lang,
      t: dicts[lang],
      setLang,
      variant,
      city,
      setCity,
      sheetOpen,
      openSheet,
      closeSheet,
    }),
    [lang, setLang, variant, city, setCity, sheetOpen, openSheet, closeSheet],
  );
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
