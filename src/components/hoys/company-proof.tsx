import { useApp } from "@/lib/app-context";

function CompanyTicker({ label, names }: { label: string; names: string[] }) {
  return (
    <span className="company-proof-row">
      <span>{label}</span>
      <span className="sr-only">{names.join(", ")}</span>
      <span className="company-ticker" aria-hidden="true">
        <span className="company-ticker-track">
          {[...names, names[0]].map((name, index) => (
            <b key={`${name}-${index}`}>{name}</b>
          ))}
        </span>
      </span>
      <b className="company-static" aria-hidden="true">
        {names.join(", ")}
      </b>
    </span>
  );
}

export function CompanyProof() {
  const { t } = useApp();
  return (
    <div className="company-proof">
      <div className="company-proof-sequence" aria-hidden="true">
        <div className="company-proof-sequence-track">
          <CompanyTicker label={t.trust.teamLabel} names={t.trust.teamNames} />
          <CompanyTicker label={t.trust.backedLabel} names={t.trust.backedNames} />
          <CompanyTicker label={t.trust.teamLabel} names={t.trust.teamNames} />
        </div>
      </div>
      <span className="sr-only">
        {t.trust.teamLabel} {t.trust.teamNames.join(", ")}. {t.trust.backedLabel}{" "}
        {t.trust.backedNames.join(", ")}.
      </span>
      <div className="company-proof-static" aria-hidden="true">
        <b>{t.trust.teamLabel}</b> {t.trust.teamNames.join(", ")}. <b>{t.trust.backedLabel}</b>{" "}
        {t.trust.backedNames.join(", ")}.
      </div>
    </div>
  );
}
