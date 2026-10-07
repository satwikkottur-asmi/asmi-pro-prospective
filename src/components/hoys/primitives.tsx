import type { ReactNode } from "react";
import { useApp } from "@/lib/app-context";

// Two-plate riso art: ink base plus an offset lime plate multiplied on top.
export function Plate({
  base,
  lime,
  alt,
  w,
  h,
  eager,
  settle,
}: {
  base: string;
  lime?: string;
  alt: string;
  w: number;
  h: number;
  eager?: boolean;
  settle?: boolean;
}) {
  const loading = eager ? "eager" : "lazy";
  return (
    <div className={settle ? "plate settle" : "plate"}>
      <img
        src={base}
        alt={alt}
        width={w}
        height={h}
        loading={loading}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
      {lime && (
        <img
          className="lime-plate"
          src={lime}
          alt=""
          aria-hidden
          width={w}
          height={h}
          loading={loading}
          decoding="async"
        />
      )}
    </div>
  );
}

// Standard landing section: bordered story band, wrapped content, optional heading + sub.
export function Section({
  name,
  id,
  heading,
  sub,
  children,
}: {
  name: string;
  id?: string;
  heading?: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`sec story-section ${name}-section`} id={id}>
      <div className="wrap">
        {heading && <h2>{heading}</h2>}
        {sub && <p className="sub">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="list">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

export function LiveLine({ children }: { children: ReactNode }) {
  return (
    <p className="live">
      <i aria-hidden />
      <span>{children}</span>
    </p>
  );
}

// Primary CTA that opens the signup sheet, with the live spots line under it.
export function JoinCta({ source, spots }: { source: string; spots: number }) {
  const { t, openSheet } = useApp();
  return (
    <div className="join-cta">
      <button type="button" className="btn" onClick={() => openSheet(source)}>
        {t.cta}
      </button>
      <LiveLine>{t.live.remaining(spots)}</LiveLine>
    </div>
  );
}
