import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import rishPhoto from "@/assets/rish-founder.jpg";
import satwikPhoto from "@/assets/satwik-founder.jpg";
import heroBase from "@/assets/scene-hero3-base.webp";
import heroLime from "@/assets/scene-hero3-lime.webp";
import invBase from "@/assets/scene-invoice-base.webp";
import invLime from "@/assets/scene-invoice-lime.webp";
import paidArt from "@/assets/scene-paid.webp";
import {
  CITY_SPOTS,
  COMMISSION_START_PERCENT,
  CREW_FREE,
  HAS_PRO_QUOTE,
  LAUNCH_CITIES,
  type LaunchCity,
  PRO_QUOTE,
  PROMO_COUNTER,
  SHOW_FOUNDER_PHOTOS,
} from "@/config";
import { useApp } from "@/lib/app-context";
import { prefersReducedMotion } from "@/lib/motion";
import { type Stats, showCounts, spotsLeft, useStats } from "@/lib/stats";
import { Footer, TopBar } from "./chrome";
import { CompanyProof } from "./company-proof";
import { DayThread } from "./day-thread";
import { BrandText, CheckList, JoinCta, LiveLine, Plate, Section } from "./primitives";
import { SignupSheet } from "./signup";

// Promotional counters (PROMO_COUNTER in config.ts; frozen under reduced motion):
// - Start from backend stats: "spots left" = `remaining`, city cards = `cities`; hidden until they load
// - One step every random 10–60s → one fewer spot + one more join in a random launch city
// - Stops for good after 100 steps; never drops below 1 unless the backend says 0
// - Saved in localStorage so refreshes keep the same numbers and resume from there
const PROMO_TICK_MIN_MS = 10_000;
const PROMO_TICK_MAX_MS = 60_000;
const PROMO_MAX_TICKS = 100;
const PROMO_KEY = "hoys_promo";

type Promo = { ticks: number; joined: Record<LaunchCity, number> }; // joined = extra joins per city
const EMPTY_PROMO: Promo = { ticks: 0, joined: { bay_area: 0, los_angeles: 0, new_york: 0 } };

// Example job used in the payout card.
const JOB_PRICE = 300;
const JOB_FEE = Math.round((JOB_PRICE * COMMISSION_START_PERCENT) / 100);

const BAR_CELLS = 20;

function Hero({ spots }: { spots: number | null }) {
  const { t, variant } = useApp();
  return (
    <section className="hero-section">
      <div className="wrap hero-layout">
        <div className="hero-copy">
          <h1>{t.hero.h1[variant]}</h1>
          <p className="sub hero-sub">
            <BrandText text={t.hero.sub} mark />
          </p>
          <JoinCta source="hero" spots={spots} />
        </div>
        <div className="hero-visual">
          <Plate
            base={heroBase}
            lime={heroLime}
            alt={t.hero.artAlt}
            w={1000}
            h={747}
            eager
            settle
          />
          <div className="chip">
            <span className="tag">{t.example}</span>
            <p>{t.hero.chipTitle}</p>
            <small>{t.hero.chipSub}</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function Trust() {
  const { t } = useApp();
  const scrollToTeam = () =>
    document
      .getElementById("team")
      ?.scrollIntoView({ behavior: prefersReducedMotion() ? "instant" : "smooth" });
  return (
    <button
      type="button"
      className="band trust-band"
      aria-label={t.trust.aria}
      onClick={scrollToTeam}
    >
      <div className="wrap">
        <CompanyProof />
      </div>
    </button>
  );
}

function Pain() {
  const { t } = useApp();
  return (
    <section className="sec story-section pain-section">
      <div className="wrap desktop-story-grid">
        <div>
          <h2>{t.pain.h2}</h2>
          <p className="pain-fix desktop-only">{t.pain.fix}</p>
        </div>
        <div className="obj pains">
          {t.pain.items.map((p) => (
            <p key={p} className="pain">
              <span className="xmark" aria-hidden />
              {p}
            </p>
          ))}
        </div>
        <p className="pain-fix mobile-only">{t.pain.fix}</p>
      </div>
    </section>
  );
}

function FeatureCard({
  art,
  label,
  title,
  items,
  aside,
  clip,
  children,
}: {
  art: ReactNode;
  label: string;
  title: string;
  items: string[];
  aside?: ReactNode;
  clip?: boolean;
  children?: ReactNode;
}) {
  return (
    <article className={clip ? "obj feature clipped" : "obj feature"}>
      {clip && <span className="clipbar" aria-hidden />}
      <div className="feature-art">{art}</div>
      <div className={aside ? "feature-body with-aside" : "feature-body"}>
        <div className="pad">
          <span className="label">{label}</span>
          <h3>{title}</h3>
          <CheckList items={items} />
          {children}
        </div>
        {aside}
      </div>
    </article>
  );
}

function TwoThings() {
  const { t } = useApp();
  const tw = t.two;
  return (
    <Section name="two" heading={<BrandText text={tw.h2} mark />}>
      <div className="split">
        <FeatureCard
          art={
            <img src={paidArt} alt="" width={1000} height={811} loading="lazy" decoding="async" />
          }
          label={tw.paidLabel}
          title={tw.paidH3}
          items={tw.paidList}
          aside={
            <div className="tear" aria-hidden>
              {tw.admit}
            </div>
          }
        />
        <FeatureCard
          clip
          art={<Plate base={invBase} lime={invLime} alt="" w={720} h={582} />}
          label={tw.crewLabel}
          title={tw.crewH3}
          items={tw.crewList}
        >
          <p className="small note">
            {tw.note}
            {CREW_FREE && tw.noteFree}
          </p>
        </FeatureCard>
      </div>
    </Section>
  );
}

function Day() {
  const { t } = useApp();
  return (
    <Section name="day" heading={t.day.h2} sub={t.day.sub}>
      <DayThread />
    </Section>
  );
}

function ProQuote() {
  if (!HAS_PRO_QUOTE || !PRO_QUOTE.text) return null;
  return (
    <section className="sec quote-section">
      <div className="wrap">
        <figure className="obj pro-quote">
          <blockquote>{PRO_QUOTE.text}</blockquote>
          <figcaption className="small">
            {[PRO_QUOTE.name, PRO_QUOTE.trade, PRO_QUOTE.city].filter(Boolean).join(", ")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function PaidDetail() {
  const { t } = useApp();
  const p = t.paid;
  return (
    <Section name="paid" heading={p.h2} sub={p.rate}>
      <div className="split">
        <div className="obj payout">
          <div className="pad">
            <span className="tag">{t.example}</span>
            <h3>{p.job}</h3>
            <p className="small">{p.when}</p>
            <p className="row">
              <span>{p.r1}</span>
              <b className="tnum">${JOB_PRICE}</b>
            </p>
            <p className="row">
              <span>{p.r2}</span>
              <b className="tnum">${JOB_FEE}</b>
            </p>
            <p className="row tot">
              <span>{p.tot}</span>
              <span className="tnum">${JOB_PRICE - JOB_FEE}</span>
            </p>
          </div>
          <div className="payout-stamps" aria-hidden>
            <span className="pstamp lime">{p.take}</span>
            <span className="pstamp">{p.pass}</span>
          </div>
        </div>
        <div>
          <div className="obj cmp" role="table">
            <div className="h" role="row">
              <span role="columnheader">{p.cmpL}</span>
              <span role="columnheader">{p.cmpR}</span>
            </div>
            {p.rows.map(([a, b]) => (
              <div className="r" role="row" key={a}>
                <span role="cell">{a}</span>
                <span role="cell">{b}</span>
              </div>
            ))}
          </div>
          <div className="explain">
            <b>{p.whereQ}</b>
            <p>
              <BrandText text={p.whereA} />
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function How() {
  const { t } = useApp();
  return (
    <Section name="how" heading={t.how.h2}>
      <ol className="route">
        {t.how.steps.map(([title, body], i) => (
          <li className="stop" key={title}>
            <i aria-hidden>{i + 1}</i>
            <b>{title}</b>
            <span>{body}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Founder({
  src,
  initials,
  name,
  role,
  text,
}: {
  src: string;
  initials: string;
  name: string;
  role: string;
  text: string;
}) {
  const [failed, setFailed] = useState(!SHOW_FOUNDER_PHOTOS);
  return (
    <article className="founder-card">
      <div className={failed ? "photo initials" : "photo"} aria-hidden={failed}>
        {failed ? (
          initials
        ) : (
          <img
            src={src}
            alt={name}
            width={96}
            height={112}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <div>
        <b className="founder-name">{name}</b>
        <span className="founder-role">{role}</span>
        <p className="founder-bio">{text}</p>
      </div>
    </article>
  );
}

function Team() {
  const { t } = useApp();
  const tm = t.team;
  return (
    <Section name="team" id="team" heading={tm.h2}>
      <div className="split team-grid">
        <Founder src={rishPhoto} initials="R" name="Rish" role={tm.rishiRole} text={tm.rishi} />
        <Founder
          src={satwikPhoto}
          initials="S"
          name="Satwik"
          role={tm.satwikRole}
          text={tm.satwik}
        />
      </div>
    </Section>
  );
}

// Cells fill one after another via CSS transition delays once the bar scrolls into view.
function SpotBar({ taken, cap }: { taken: number; cap: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const filled = Math.min(BAR_CELLS, Math.round((taken / cap) * BAR_CELLS));
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return setInView(true);
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setInView(true);
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      className={inView ? "bar in" : "bar"}
      ref={ref}
      style={{ "--step": `${500 / Math.max(1, filled)}ms` } as CSSProperties}
      aria-hidden
    >
      {Array.from({ length: BAR_CELLS }, (_, i) => (
        <i key={i} className={i < filled ? "f" : undefined} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

// `joined` null → stats not loaded (or failed): show the city name only.
function CityCard({ city, joined }: { city: LaunchCity; joined: number | null }) {
  const { t } = useApp();
  const cap = CITY_SPOTS[city];
  const taken = joined == null || cap == null ? joined : Math.min(joined, cap);
  return (
    <div className="obj city-card">
      <div className="city-head">
        <b>{t.cities[city]}</b>
        {joined != null && taken != null && (
          <span className="tnum">
            {cap == null ? t.spots.joined(joined) : t.spots.taken(taken, cap)}
          </span>
        )}
      </div>
      {cap != null && taken != null && <SpotBar taken={taken} cap={cap} />}
      {cap != null && taken != null && taken >= cap && (
        <div className="city-full">
          <span className="stamp">{t.spots.full}</span>
          <span>{t.spots.next}</span>
        </div>
      )}
    </div>
  );
}

// City counts = backend `cities` + the promo counter's extra joins (0 while it's off).
// Hidden until `showCounts` (total ≥ MIN_COUNT_TO_SHOW) → no "0 pros joined" on launch day.
function Spots({ stats, joined }: { stats: Stats | undefined; joined: Promo["joined"] }) {
  const { t } = useApp();
  return (
    <Section name="spots" heading={t.spots.h2} sub={t.spots.sub}>
      <div className="city-grid">
        {LAUNCH_CITIES.map((city) => (
          <CityCard
            key={city}
            city={city}
            joined={showCounts(stats) ? (stats.cities[city] ?? 0) + joined[city] : null}
          />
        ))}
      </div>
    </Section>
  );
}

function Final({ stats, spots }: { stats: Stats | undefined; spots: number | null }) {
  const { t, city } = useApp();
  const left = showCounts(stats) ? spotsLeft(stats, city) : null;
  return (
    <section className="band sec final-section">
      <div className="wrap">
        <h2>{t.final.h2}</h2>
        {left != null && city && <LiveLine>{t.live.left(left, t.cities[city])}</LiveLine>}
        <JoinCta source="final" spots={spots} />
      </div>
    </section>
  );
}

// Saved promo state; anything malformed → start fresh.
function loadPromo(): Promo {
  try {
    const p = JSON.parse(localStorage.getItem(PROMO_KEY) ?? "null") as Promo | null;
    const valid =
      Number.isInteger(p?.ticks) && LAUNCH_CITIES.every((c) => Number.isInteger(p?.joined?.[c]));
    if (p && valid) return { ticks: Math.min(p.ticks, PROMO_MAX_TICKS), joined: p.joined };
  } catch {
    /* corrupt or blocked storage */
  }
  return EMPTY_PROMO;
}

// PROMO_COUNTER off → no ticking, no storage; always EMPTY_PROMO.
function usePromo(): Promo {
  const [promo, setPromo] = useState(() => (PROMO_COUNTER ? loadPromo() : EMPTY_PROMO));
  useEffect(() => {
    if (!PROMO_COUNTER || prefersReducedMotion() || promo.ticks >= PROMO_MAX_TICKS) return;
    // Chained timeouts: each step gets a fresh random delay.
    let timer: number;
    const schedule = () => {
      const delay = PROMO_TICK_MIN_MS + Math.random() * (PROMO_TICK_MAX_MS - PROMO_TICK_MIN_MS);
      timer = window.setTimeout(() => {
        // Re-read storage so several open tabs advance one shared count instead of each their own.
        const cur = loadPromo();
        if (cur.ticks >= PROMO_MAX_TICKS) return setPromo(cur);
        const city = LAUNCH_CITIES[Math.floor(Math.random() * LAUNCH_CITIES.length)] as LaunchCity;
        const next = {
          ticks: cur.ticks + 1,
          joined: { ...cur.joined, [city]: cur.joined[city] + 1 },
        };
        try {
          localStorage.setItem(PROMO_KEY, JSON.stringify(next));
        } catch {
          /* storage full or blocked: keep counting in memory */
        }
        setPromo(next);
        if (next.ticks < PROMO_MAX_TICKS) schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
    // Runs once per mount; later progress is read from storage inside the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return promo;
}

export function Landing() {
  const { data: stats } = useStats();
  const promo = usePromo();
  // Backend `remaining` minus counter steps (0 while PROMO_COUNTER is off). Null → line hidden.
  // Floors at 1 so the counter alone never shows "full"; only a backend 0 does.
  // Same `showCounts` gate as the city cards.
  const remaining = showCounts(stats) ? stats.remaining : undefined;
  const spots =
    remaining == null ? null : Math.max(remaining - promo.ticks, Math.min(remaining, 1));

  return (
    <>
      <TopBar />
      <main>
        <Hero spots={spots} />
        <Trust />
        <Pain />
        <TwoThings />
        <Day />
        <ProQuote />
        <PaidDetail />
        <How />
        <Team />
        <Spots stats={stats} joined={promo.joined} />
        <Final stats={stats} spots={spots} />
      </main>
      <Footer />
      <SignupSheet />
    </>
  );
}
