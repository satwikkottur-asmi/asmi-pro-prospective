import { useEffect, useRef, useState } from "react";
import { track, useApp } from "@/lib/app-context";
import { prefersReducedMotion } from "@/lib/motion";

type Item = { k: "ts" | "in" | "out" | "stamp"; key: string; role?: number };

// Role indexes: 0 Front desk, 1 Estimator, 2 Parts runner, 3 Paid jobs, 4 Dispatcher, 5 Bookkeeper
const SCRIPT: Item[] = [
  { k: "ts", key: "6:30 AM" },
  { k: "in", key: "m1" },
  { k: "ts", key: "7:12 AM" },
  { k: "in", key: "m2", role: 0 },
  { k: "out", key: "m3" },
  { k: "stamp", key: "s3" },
  { k: "ts", key: "7:47 AM" },
  { k: "out", key: "m4" },
  { k: "in", key: "m5", role: 1 },
  { k: "out", key: "m6" },
  { k: "stamp", key: "s6", role: 2 },
  { k: "ts", key: "9:40 AM" },
  { k: "in", key: "m7", role: 3 },
  { k: "out", key: "m8" },
  { k: "stamp", key: "s8" },
  { k: "ts", key: "11:20 AM" },
  { k: "out", key: "m9", role: 4 },
  { k: "in", key: "m10" },
  { k: "ts", key: "6:30 PM" },
  { k: "in", key: "m11", role: 5 },
  { k: "stamp", key: "s11" },
];

export function DayThread() {
  const { t } = useApp();
  const m = t.day.msgs as Record<string, string>;
  const ref = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(-1);
  const [role, setRole] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const timers = useRef<number[]>([]);
  const completed = useRef(false); // thread_complete: first playthrough only, not replays

  const play = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    threadRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setShown(0);
    setTyping(-1);
    setRole(null);
    let at = 200;
    SCRIPT.forEach((it, i) => {
      if (it.k === "in") {
        timers.current.push(window.setTimeout(() => setTyping(i), at));
        at += 650;
      }
      timers.current.push(
        window.setTimeout(() => {
          setTyping(-1);
          setShown(i + 1);
          if (it.role != null) setRole(it.role);
          if (i === SCRIPT.length - 1 && !completed.current) {
            completed.current = true;
            track("thread_complete");
          }
        }, at),
      );
      at += it.k === "ts" ? 250 : 1400;
    });
    setRunId((r) => r + 1);
  };

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(SCRIPT.length);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let started = false;
    let hasScrolled = window.scrollY > 0;
    const startWhenVisible = () => {
      if (started || !hasScrolled) return;
      const bounds = el.getBoundingClientRect();
      const visibleHeight = Math.max(
        0,
        Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0),
      );
      if (visibleHeight < Math.min(bounds.height * 0.4, window.innerHeight * 0.5)) return;
      started = true;
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      play();
    };
    const onScroll = () => {
      hasScrolled = true;
      startWhenVisible();
    };
    const io = new IntersectionObserver(
      (es) => {
        if (es[0]?.isIntersecting) startWhenVisible();
      },
      { threshold: 0.4 },
    );
    window.addEventListener("scroll", onScroll, { passive: true });
    io.observe(el);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread || runId === 0 || prefersReducedMotion()) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: shown === 0 ? "instant" : "smooth" });
  }, [shown, typing, runId]);

  const done = shown >= SCRIPT.length;

  return (
    <div>
      <div className="phone" ref={ref}>
        <div className="ph-top">
          <span className="av" aria-hidden>
            h
          </span>
          <div>
            <b>Hoys</b>
            <small>{t.day.biz}</small>
          </div>
        </div>
        <ol className="thread" ref={threadRef} tabIndex={0} aria-label={t.day.h2}>
          {SCRIPT.map((it, i) => {
            const isTyping = typing === i;
            if (i >= shown && !isTyping) return null;
            if (it.k === "ts")
              return (
                <li key={i} className="ts">
                  {it.key}
                </li>
              );
            if (it.k === "stamp")
              return (
                <li key={i} className={runId ? "stamp land" : "stamp"}>
                  {m[it.key]}
                </li>
              );
            return (
              <li key={i} className={`bub ${it.k}`}>
                <span className="sr-only">{it.k === "in" ? "Hoys: " : `${t.day.you}: `}</span>
                {isTyping ? (
                  <>
                    {/* Invisible copy sizes the typing bubble to the final message width. */}
                    <span className="bub-sizer">{m[it.key]}</span>
                    <span className="dots" aria-hidden>
                      <i />
                      <i />
                      <i />
                    </span>
                  </>
                ) : (
                  m[it.key]
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="roles" aria-hidden>
        {t.day.roles.map((r, i) => (
          <span key={r} className={role === i ? "on" : ""}>
            {r}
          </span>
        ))}
      </div>
      <div className="replay">
        {done && runId > 0 && (
          <button type="button" className="linkbtn" onClick={play}>
            {t.day.replay}
          </button>
        )}
      </div>
    </div>
  );
}
