import { AsYouType, isValidPhoneNumber } from "libphonenumber-js";
import {
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import callBase from "@/assets/scene-call-base.webp";
import callLime from "@/assets/scene-call-lime.webp";
import {
  CITY_KEYS,
  type CityKey,
  CREW_KEYS,
  type CrewKey,
  NEXT_STEPS_TIMING,
  REFERRAL_BUMP,
  SITE_URL,
  TRADE_KEYS,
  type TradeKey,
} from "@/config";
import { postSignup } from "@/lib/api";
import { getAttribution, track, useApp } from "@/lib/app-context";
import { EMAIL_RE, ZIP_RE } from "@/lib/validation";
import { Plate } from "./primitives";

type Field = "city" | "serviceCity" | "name" | "phone" | "consent" | "net" | "zip" | "email";
type Errs = Partial<Record<Field, string>>;
type Saved = {
  token: string | null;
  ref_code: string | null;
  position: number | null;
  city: CityKey;
};

const TITLE_ID = "signup-title";

// Label + input + live error line. Ids: input `f-<name>`, error `e-<name>`.
function TextField({
  name,
  label,
  error,
  ...input
}: { name: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const hasError = error !== undefined;
  return (
    <>
      <label className="flabel" htmlFor={`f-${name}`}>
        {label}
      </label>
      <input
        id={`f-${name}`}
        className="field"
        aria-invalid={hasError ? !!error : undefined}
        aria-describedby={hasError ? `e-${name}` : undefined}
        {...input}
      />
      {hasError && <ErrorLine id={`e-${name}`}>{error}</ErrorLine>}
    </>
  );
}

function ErrorLine({
  id,
  center,
  children,
}: {
  id?: string;
  center?: boolean;
  children?: ReactNode;
}) {
  return (
    <p className={center ? "err center" : "err"} id={id} aria-live="polite">
      {children}
    </p>
  );
}

// Chip group: single choice (radio semantics) or multi choice (toggle buttons).
function Choices<K extends string>({
  legend,
  options,
  labels,
  isOn,
  onPick,
  multi,
  id,
  error,
}: {
  legend: string;
  options: readonly K[];
  labels: Record<K, string>;
  isOn: (k: K) => boolean;
  onPick: (k: K) => void;
  multi?: boolean;
  id?: string;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="flabel">{legend}</legend>
      <div
        className="chips"
        role={multi ? undefined : "radiogroup"}
        aria-label={multi ? undefined : legend}
        id={id}
        tabIndex={id ? -1 : undefined}
      >
        {options.map((k) => (
          <button
            key={k}
            type="button"
            role={multi ? undefined : "radio"}
            aria-checked={multi ? undefined : isOn(k)}
            aria-pressed={multi ? isOn(k) : undefined}
            onClick={() => onPick(k)}
          >
            {labels[k]}
          </button>
        ))}
      </div>
      {error !== undefined && <ErrorLine>{error}</ErrorLine>}
    </fieldset>
  );
}

function Submit({
  busy,
  label,
  savingLabel,
  error,
}: {
  busy: boolean;
  label: string;
  savingLabel: string;
  error?: string | undefined;
}) {
  return (
    <>
      <button type="submit" className="btn submit" disabled={busy}>
        {busy ? savingLabel : label}
      </button>
      <ErrorLine center>{error}</ErrorLine>
    </>
  );
}

function ActionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card2">
      <p className="card2-title">{title}</p>
      {children}
    </div>
  );
}

export function SignupFlow({ onClose }: { onClose?: () => void }) {
  const { t, lang, city: ctxCity, setCity, variant } = useApp();
  const s = t.sheet;
  const [step, setStep] = useState(1);
  const [city, setCityLocal] = useState<CityKey | null>(ctxCity);
  const [serviceCity, setServiceCity] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [errs, setErrs] = useState<Errs>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  // step 2
  const [trades, setTrades] = useState<TradeKey[]>([]);
  const [tradeOther, setTradeOther] = useState("");
  const [crew, setCrew] = useState<CrewKey | null>(null);
  const [zip, setZip] = useState("");
  const [biz, setBiz] = useState("");
  const [email, setEmail] = useState("");
  // step 3
  const [called, setCalled] = useState(false);
  const [copied, setCopied] = useState(false);

  const clearErr = (f: Field) => setErrs((e) => ({ ...e, [f]: "" }));

  async function submit1(e: FormEvent) {
    e.preventDefault();
    const er: Errs = {};
    if (!city) er.city = s.errCity;
    if (city === "other" && !serviceCity.trim()) er.serviceCity = s.errOtherCity;
    if (!name.trim()) er.name = s.errName;
    if (!isValidPhoneNumber(phone, "US")) er.phone = s.errPhone;
    if (!consent) er.consent = s.errConsent;
    setErrs(er);
    track("step1_submit");
    const fields = Object.keys(er);
    if (fields.length) {
      for (const field of fields) track("step1_error", { field });
      document.getElementById(`f-${fields[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await postSignup({
        stage: 1,
        city: city as CityKey,
        service_city: serviceCity,
        name,
        phone,
        consent: true,
        lang,
        variant,
        hp,
        consent_text: t.consentText,
        attribution: getAttribution(),
      });
      if (!res.ok) {
        setErrs(res.error === "phone" ? { phone: s.errPhone } : { net: s.errNet });
        track("step1_error", { field: res.error ?? "network" });
        return;
      }
      const picked = city as CityKey;
      setCity(picked);
      setSaved({
        token: res.data.token,
        ref_code: res.data.ref_code,
        position: null,
        city: picked,
      });
      track("step1_success", { city: picked });
      setStep(2);
    } catch {
      setErrs({ net: s.errNet });
      track("step1_error", { field: "network" });
    } finally {
      setBusy(false);
    }
  }

  async function submit2(e: FormEvent) {
    e.preventDefault();
    const er: Errs = {};
    if (zip && !ZIP_RE.test(zip)) er.zip = s.errZip;
    if (email && !EMAIL_RE.test(email)) er.email = s.errEmail;
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    track("step2_submit", { trades: trades.length, crew });
    try {
      if (saved?.token) {
        const res = await postSignup({
          stage: 2,
          token: saved.token,
          trades,
          trade_other: tradeOther,
          crew_size: crew,
          zip,
          business_name: biz,
          email,
        });
        if (!res.ok) {
          setErrs({ net: s.errNet });
          return;
        }
        const { position } = res.data;
        setSaved((cur) => (cur ? { ...cur, position } : cur));
      }
      setStep(3);
    } catch {
      setErrs({ net: s.errNet });
    } finally {
      setBusy(false);
    }
  }

  const base = SITE_URL || window.location.origin;
  const shareUrl = saved?.ref_code ? `${base}/?ref=${saved.ref_code}` : `${base}/`;

  async function copy() {
    track("share_click", { method: "copy" });
    try {
      await navigator.clipboard.writeText(`${s.shareText} ${shareUrl}`);
      setCopied(true);
    } catch {
      /* clipboard blocked */
    }
  }
  async function share() {
    track("share_click", { method: "share" });
    if (!navigator.share) return copy();
    try {
      await navigator.share({ text: s.shareText, url: shareUrl });
    } catch {
      /* cancelled */
    }
  }
  async function callMe() {
    track("demo_request");
    if (saved?.token)
      await postSignup({ stage: 3, token: saved.token, demo_call_requested: true }).catch(() => {});
    setCalled(true);
  }

  // Heading level: dialog title in the sheet, page h1 on /join.
  const Title = onClose ? "h2" : "h1";

  return (
    <div>
      <div className="flow-head mono">
        <span>{s.workOrder}</span>
        {onClose && (
          // The flow mounts after showModal(), so focus the close button like the dialog would.
          // biome-ignore lint/a11y/noAutofocus: initial focus inside a modal dialog
          <button type="button" className="xbtn" aria-label={s.close} onClick={onClose} autoFocus />
        )}
      </div>
      <div className="prog" aria-hidden>
        {[1, 2, 3].map((i) => (
          <i key={i} className={i <= step ? "f" : undefined} />
        ))}
      </div>

      {step === 1 && (
        <form onSubmit={submit1} noValidate>
          <Title id={TITLE_ID} className="flow-title">
            {s.h}
          </Title>
          <p className="flow-sub">{s.hSub}</p>

          <Choices
            legend={s.where}
            options={CITY_KEYS}
            labels={t.cities}
            isOn={(c) => city === c}
            onPick={(c) => {
              setCityLocal(c);
              clearErr("city");
            }}
            id="f-city"
            error={errs.city ?? ""}
          />

          {city === "other" && (
            <TextField
              name="serviceCity"
              label={s.otherCity}
              error={errs.serviceCity ?? ""}
              autoComplete="address-level2"
              placeholder={s.otherCityPh}
              value={serviceCity}
              maxLength={100}
              onChange={(e) => {
                setServiceCity(e.target.value);
                clearErr("serviceCity");
              }}
            />
          )}

          <TextField
            name="name"
            label={s.name}
            error={errs.name ?? ""}
            autoComplete="name"
            placeholder={s.namePh}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />

          <TextField
            name="phone"
            label={s.phone}
            error={errs.phone ?? ""}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(415) 555-0123"
            value={phone}
            onChange={(e) => {
              const v = e.target.value;
              // Format while typing, but let deletions through untouched.
              setPhone(v.length < phone.length ? v : new AsYouType("US").input(v));
            }}
          />

          <div className="hp" aria-hidden>
            <label htmlFor="company_website">Company website</label>
            <input
              id="company_website"
              name="company_website"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </div>

          <label className="consent" htmlFor="f-consent">
            <input
              id="f-consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-describedby="e-consent"
            />
            <b>{s.consentBold}</b>
          </label>
          <ErrorLine id="e-consent">{errs.consent}</ErrorLine>

          <Submit busy={busy} label={s.h} savingLabel={s.saving} error={errs.net} />
        </form>
      )}

      {step === 2 && (
        <form onSubmit={submit2} noValidate>
          <Title id={TITLE_ID} className="flow-title">
            {s.s2h}
          </Title>
          <p className="flow-sub">{s.s2sub}</p>

          <Choices
            multi
            legend={s.trades}
            options={TRADE_KEYS}
            labels={s.tradeLabels}
            isOn={(k) => trades.includes(k)}
            onPick={(k) =>
              setTrades((tr) => (tr.includes(k) ? tr.filter((x) => x !== k) : [...tr, k]))
            }
          />
          {trades.includes("other") && (
            <TextField
              name="other"
              label={s.whichTrade}
              value={tradeOther}
              maxLength={60}
              onChange={(e) => setTradeOther(e.target.value)}
            />
          )}

          <Choices
            legend={s.crew}
            options={CREW_KEYS}
            labels={s.crewLabels}
            isOn={(k) => crew === k}
            onPick={setCrew}
          />

          <TextField
            name="zip"
            label={s.zip}
            error={errs.zip ?? ""}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          />
          <TextField
            name="biz"
            label={s.biz}
            autoComplete="organization"
            maxLength={120}
            value={biz}
            onChange={(e) => setBiz(e.target.value)}
          />
          <TextField
            name="email"
            label={s.email}
            error={errs.email ?? ""}
            type="email"
            autoComplete="email"
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <Submit busy={busy} label={s.save} savingLabel={s.saving} error={errs.net} />
        </form>
      )}

      {step === 3 && saved && (
        <div>
          <Title id={TITLE_ID} className="sr-only">
            {s.s2h}
          </Title>
          <div className="done-art">
            <Plate base={callBase} lime={callLime} alt="" w={720} h={518} eager />
            <span className="stamp">{s.onList}</span>
          </div>
          <div className="done-status">
            {saved.position != null && <b className="tnum">#{saved.position}</b>}
            <span>{saved.city === "other" ? s.onTheList : s.inCity(t.cities[saved.city])}</span>
          </div>
          <ol className="dashrows">
            {[
              s.step1,
              `${s.step2(t.citiesShort[saved.city])}${NEXT_STEPS_TIMING ? ` ${NEXT_STEPS_TIMING}` : ""}`,
              s.step3,
            ].map((text, i) => (
              <li key={text}>
                <b>{i + 1}.</b> {text}
              </li>
            ))}
          </ol>
          <ActionCard title={s.knowPro}>
            {REFERRAL_BUMP > 0 && <p className="card2-note">{s.bump(REFERRAL_BUMP)}</p>}
            <div className="card2-actions">
              <button type="button" className="btn-2 lime" onClick={share}>
                {s.share}
              </button>
              <button type="button" className="btn-2" onClick={copy} aria-live="polite">
                {copied ? s.copied : s.copy}
              </button>
            </div>
          </ActionCard>
          <ActionCard title={s.call}>
            {called ? (
              <p className="card2-done" role="status">
                {s.callDone}
              </p>
            ) : (
              <button type="button" className="btn-2 card2-btn" onClick={callMe}>
                {s.callBtn}
              </button>
            )}
          </ActionCard>
        </div>
      )}
    </div>
  );
}

// Native modal <dialog>: focus trap, Esc, inert page and focus return come from the browser.
// Each open remounts the flow so it starts fresh at step 1.
export function SignupSheet() {
  const { sheetOpen, closeSheet } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (sheetOpen && !dialog.open) {
      setSession((n) => n + 1);
      dialog.showModal();
    } else if (!sheetOpen && dialog.open) {
      dialog.close();
    }
  }, [sheetOpen]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={TITLE_ID}
      onClose={closeSheet}
      // Clicks on the ::backdrop target the dialog itself; content clicks hit .sheet-scroll.
      onClick={(e) => e.target === e.currentTarget && closeSheet()}
    >
      <div className="sheet-scroll">
        <div className="handle" aria-hidden />
        {session > 0 && <SignupFlow key={session} onClose={closeSheet} />}
      </div>
    </dialog>
  );
}
