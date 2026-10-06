import type { ReactNode } from "react";
import { Link } from "react-router";
import logo from "@/assets/asmi-mark-ink.png";
import { SUPPORT_EMAIL, SUPPORT_TEXT_NUMBER } from "@/config";
import { useApp } from "@/lib/app-context";
import type { Lang } from "@/lib/dict";

const LANGS: Lang[] = ["en", "es"];

function Logo({ className, lazy }: { className: string; lazy?: boolean }) {
  return (
    <img
      src={logo}
      alt="Asmi"
      width={696}
      height={264}
      className={className}
      loading={lazy ? "lazy" : undefined}
    />
  );
}

export function TopBar() {
  const { lang, setLang, t } = useApp();
  return (
    <header className="wrap top">
      <Link to="/" aria-label="Asmi home">
        <Logo className="logo-top" />
      </Link>
      <div className="top-actions">
        {SUPPORT_TEXT_NUMBER && (
          <a className="top-text" href={`sms:${SUPPORT_TEXT_NUMBER}`}>
            {t.top.textUs}
          </a>
        )}
        <div className="lang" role="group" aria-label={t.top.langLabel}>
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={lang === l}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useApp();
  return (
    <footer className="wrap footer">
      <Logo className="logo-footer" lazy />
      <p>Humint Labs, Inc. 710 Lakeway Drive, Suite 200, Sunnyvale, CA 94085</p>
      <p>
        {t.footer.questions} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        {SUPPORT_TEXT_NUMBER && (
          <>
            {" "}
            · {t.footer.text} <a href={`sms:${SUPPORT_TEXT_NUMBER}`}>{SUPPORT_TEXT_NUMBER}</a>
          </>
        )}
      </p>
      <p>© 2026 Humint Labs, Inc.</p>
    </footer>
  );
}

// Top bar + footer around a single page body.
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <TopBar />
      <main className={className}>{children}</main>
      <Footer />
    </>
  );
}
