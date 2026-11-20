"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui";
import {
  THRESHOLDS,
  isPersonalityType,
  scoreBloom,
  type Badge,
  type Flower,
  type Board,
  type BloomAnswers,
  type Tiebreaks,
} from "@/lib/bloom";
import { useBloomCopy, type BloomKey } from "@/lib/bloom-i18n";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { bloomSelfAnswers, clearSelfView, loadSelfView } from "@/lib/self-test";
import { BadgeList, BloomHeader, SIGN_IN_HREF, BoardView, FlowerGuide, Questionnaire, TypePicker, api, useErrorText } from "./shared";
import { Garden } from "./garden";

interface Me {
  user: { email: string } | null;
  survey: { code: string } | null;
}

interface Dashboard {
  user: { email: string };
  survey: {
    code: string;
    displayName: string;
    selfType: string;
    status: "open" | "closed";
    boardPublic: boolean;
    notify: boolean;
    createdAt: string;
    selfAnswered: boolean;
  } | null;
  board?: Board;
  badges?: Badge[];
  flowers?: Record<Flower, number> | null;
  responses?: Array<{ id: string; name: string; relation: string; type: string; flower: Flower | null; signedIn: boolean; submittedAt: string }>;
}

interface SelfTest {
  answers: BloomAnswers;
  tiebreaks: Tiebreaks;
}

export default function BloomHome() {
  return (
    <I18nProvider>
      <BloomHomeContent />
    </I18nProvider>
  );
}

function BloomHomeContent() {
  const { t } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [me, setMe] = useState<Me | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const current = await api<Me>("/api/auth/me");
      setMe(current);
      setDashboard(current.user && current.survey ? await api<Dashboard>("/api/bloom") : null);
    } catch (caught) {
      setError(errorText(caught));
    }
  }, [errorText]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" }).catch(() => undefined);
    setDashboard(null);
    await load();
  }

  let body;
  if (!me) {
    body = error ? <p className="form-error centered">{error}</p> : <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>;
  } else if (dashboard?.survey) {
    body = <DashboardView data={dashboard} reload={load} />;
  } else {
    body = <Setup signedIn={Boolean(me.user)} onCreated={load} />;
  }

  return (
    <main className="app-shell bloom-shell">
      <BloomHeader account={false}>
        {me?.user ? (
          <button className="text-button" onClick={signOut}>{b("nav.signOut")}</button>
        ) : me ? (
          <a className="account-link" href={SIGN_IN_HREF}>{b("nav.signIn")}</a>
        ) : null}
      </BloomHeader>
      <div className="bloom-page">{body}</div>
    </main>
  );
}

function Setup({ signedIn, onCreated }: { signedIn: boolean; onCreated: () => Promise<void> }) {
  const { locale } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [stage, setStage] = useState<"form" | "selfTest" | "signin" | "signinOnly">("form");
  const [displayName, setDisplayName] = useState("");
  const [selfType, setSelfType] = useState("");
  const [selfTest, setSelfTest] = useState<SelfTest | null>(null);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [fromHomeTest, setFromHomeTest] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // "Sign in" in the header or footer opens straight at the sign-in step.
    if (params.has("signin")) {
      if (!signedIn) setStage("signinOnly");
      params.delete("signin");
      const rest = params.toString();
      window.history.replaceState({}, "", `/bloom${rest ? `?${rest}` : ""}`);
    }
    const prefill = params.get("name");
    if (prefill) setDisplayName(prefill.slice(0, 24));
    // Letters ticked, or the 16-question self-test taken, on /start.
    const view = loadSelfView();
    if (view) {
      setSelfType(view.type);
      const handoff = bloomSelfAnswers(view);
      if (handoff) {
        setSelfTest(handoff);
        setFromHomeTest(true);
      }
    }
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      await api("/api/bloom", {
        method: "POST",
        body: JSON.stringify({
          displayName,
          selfType,
          selfAnswers: selfTest?.answers ?? null,
          selfTiebreaks: selfTest?.tiebreaks ?? null,
          notify,
          locale,
        }),
      });
      clearSelfView();
      await onCreated();
    } catch (caught) {
      setError(errorText(caught));
      setStage("form");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "selfTest") {
    return (
      <Questionnaire
        name={displayName}
        self
        onCancel={() => setStage("form")}
        onDone={(answers, tiebreaks) => {
          const type = scoreBloom(answers, tiebreaks).type;
          setSelfTest({ answers, tiebreaks });
          if (type) setSelfType(type);
          setStage("form");
        }}
      />
    );
  }

  if (stage === "signin" || stage === "signinOnly") {
    return (
      <SignInPanel
        title={stage === "signin" ? b("signin.title") : b("signin.titlePlain")}
        onBack={() => setStage("form")}
        onSignedIn={async () => {
          if (stage === "signin") await create();
          else await onCreated();
        }}
      />
    );
  }

  const ready = displayName.trim().length >= 2 && isPersonalityType(selfType);
  return (
    <>
      <section className="bloom-hero">
        <span className="eyebrow">{b("home.eyebrow")}</span>
        <h1>{b("home.title")}</h1>
        <p>{b("home.lede")}</p>
      </section>
      <form
        className="bloom-card form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          if (signedIn) void create();
          else setStage("signin");
        }}
      >
        <label className="field">
          <span>{b("setup.name")}</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required minLength={2} maxLength={24} autoComplete="nickname" />
        </label>
        <div className="field">
          <span>{b("setup.letters")}</span>
          <p className="helper-note">{b("setup.lettersHint")}</p>
          <TypePicker value={selfType} onChange={setSelfType} />
        </div>
        {selfTest && fromHomeTest ? (
          <p className="helper-note"><CheckIcon /> {b("setup.fromHome", { type: selfType })}</p>
        ) : selfTest ? (
          <p className="helper-note"><CheckIcon /> {b("setup.testDone", { type: scoreBloom(selfTest.answers, selfTest.tiebreaks).type ?? "" })}</p>
        ) : (
          <button type="button" className="text-button" onClick={() => setStage("selfTest")} disabled={displayName.trim().length < 2}>
            {b("setup.unsure")}
          </button>
        )}
        <label className="toggle-row">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <span>{b("setup.notify")}</span>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button primary wide" disabled={!ready || busy}>{b("setup.continue")} <ArrowIcon /></button>
        {!signedIn && <button type="button" className="text-button centered-button" onClick={() => setStage("signinOnly")}>{b("setup.signIn")}</button>}
      </form>
    </>
  );
}

function SignInPanel({ title, onSignedIn, onBack }: { title: string; onSignedIn: () => Promise<void>; onBack: () => void }) {
  const { locale } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/code", { method: "POST", body: JSON.stringify({ email, locale }) });
      setSent(true);
      setCode("");
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
      await onSignedIn();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="bloom-card form-stack narrow"
      onSubmit={(event) => {
        event.preventDefault();
        if (sent) void verify();
        else void send();
      }}
    >
      <button type="button" className="back-link" onClick={onBack}><ArrowIcon direction="left" /> {b("signin.back")}</button>
      <h1 className="card-title">{title}</h1>
      <p>{b("signin.body")}</p>
      {!sent ? (
        <label className="field">
          <span>{b("signin.email")}</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" inputMode="email" />
        </label>
      ) : (
        <>
          <p className="helper-note">{b("signin.sent", { email })}</p>
          <label className="field">
            <span>{b("signin.code")}</span>
            <input
              className="code-input"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="\d{6}"
            />
          </label>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
      <button className="button primary wide" disabled={busy || (sent && code.length !== 6)}>
        {sent ? b("signin.verify") : b("signin.send")} <ArrowIcon />
      </button>
      {sent && (
        <div className="inline-actions">
          <button type="button" className="text-button" onClick={send} disabled={busy}>{b("signin.resend")}</button>
          <button type="button" className="text-button" onClick={() => setSent(false)}>{b("signin.change")}</button>
        </div>
      )}
    </form>
  );
}

function DashboardView({ data, reload }: { data: Dashboard; reload: () => Promise<void> }) {
  const { locale } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const survey = data.survey!;
  const responses = data.responses ?? [];
  const total = responses.length;
  const [link, setLink] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selfTest, setSelfTest] = useState(false);
  const [letters, setLetters] = useState(survey.selfType);

  useEffect(() => setLink(`${window.location.origin}/s/${survey.code}`), [survey.code]);
  useEffect(() => setLetters(survey.selfType), [survey.selfType]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function act(work: () => Promise<unknown>, done?: string) {
    setError("");
    try {
      await work();
      await reload();
      if (done) setNotice(done);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  const patch = (body: Record<string, unknown>) => act(() => api("/api/bloom", { method: "PATCH", body: JSON.stringify(body) }), b("dash.saved"));

  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Aster", text: b("dash.shareText"), url: link }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(link);
      setNotice(b("dash.copied"));
    }
  }

  if (selfTest) {
    return (
      <Questionnaire
        name={survey.displayName}
        self
        onCancel={() => setSelfTest(false)}
        onDone={(answers, tiebreaks) => {
          setSelfTest(false);
          void act(() => api("/api/bloom/self", { method: "PUT", body: JSON.stringify({ answers, tiebreaks }) }), b("dash.saved"));
        }}
      />
    );
  }

  const milestones: Array<{ key: BloomKey; at: number }> = [
    { key: "dash.mBoard", at: THRESHOLDS.board },
    { key: "dash.mBehaviours", at: THRESHOLDS.behaviours },
    { key: "dash.mAudiences", at: THRESHOLDS.audiences },
    { key: "dash.mFlowers", at: THRESHOLDS.flowers },
  ];

  return (
    <>
      <section className="bloom-hero">
        <span className="eyebrow">{b("dash.eyebrow")}</span>
        <h1>{b("dash.title", { name: survey.displayName })}</h1>
        <p>{b("board.answers", { count: total })}{survey.status === "closed" && ` · ${b("dash.closedNote")}`}</p>
      </section>

      <section className="bloom-card link-card">
        <span className="card-kicker">{b("dash.link")}</span>
        <strong className="link-text">{link.replace(/^https?:\/\//, "")}</strong>
        <div className="inline-actions">
          <button className="button primary" onClick={share}>{b("dash.share")} <ArrowIcon /></button>
          <button className="button secondary" onClick={async () => { await navigator.clipboard.writeText(link); setNotice(b("dash.copied")); }}>{b("dash.copy")}</button>
        </div>
      </section>

      <Garden plants={[...responses].reverse()} />

      {data.flowers && <FlowerGuide counts={data.flowers} />}

      <section className="bloom-card">
        <span className="card-kicker">{b("dash.milestones")}</span>
        <ol className="milestones">
          {milestones.map((milestone) => (
            <li key={milestone.key} className={total >= milestone.at ? "reached" : ""}>
              <span>{total >= milestone.at ? <CheckIcon /> : `${Math.min(total, milestone.at)}/${milestone.at}`}</span>
              {b(milestone.key)}
            </li>
          ))}
        </ol>
        <Link className="button ink-outline" href="/bloom/report">{b("dash.openReport")} <ArrowIcon /></Link>
      </section>

      {data.badges && data.badges.length > 0 && (
        <section className="bloom-card">
          <h2 className="card-title">{b("dash.badges")}</h2>
          <BadgeList badges={data.badges} />
        </section>
      )}

      <ResultCard total={total} locale={locale} />

      <section className="bloom-card">
        <h2 className="card-title">{b("dash.boardTitle")}</h2>
        {data.board && <BoardView board={data.board} ownerName={survey.displayName} selfType={survey.selfType} />}
      </section>

      <section className="bloom-card">
        <h2 className="card-title">{b("dash.responsesTitle")}</h2>
        {responses.length === 0 ? (
          <p className="muted">{b("dash.noResponses")}</p>
        ) : (
          <ul className="response-list">
            {responses.map((response) => (
              <li key={response.id}>
                <div>
                  <strong>{response.name}</strong>
                  {response.flower && <span className={`flower-tag ${response.flower}`} title={b(`flower.meaning.${response.flower}`)}>{b(`flower.name.${response.flower}`)}</span>}
                  <small>
                    {b(`rel.${response.relation}` as BloomKey)} · {new Date(response.submittedAt).toLocaleDateString()} · {response.signedIn ? b("dash.signedIn") : b("dash.guest")}
                  </small>
                </div>
                <b>{response.type}</b>
                <button
                  className="text-button"
                  onClick={() => {
                    if (window.confirm(b("dash.removeConfirm", { name: response.name }))) {
                      void act(() => api(`/api/bloom/responses/${response.id}`, { method: "DELETE" }));
                    }
                  }}
                >
                  {b("dash.remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bloom-card">
        <h2 className="card-title">{b("dash.selfTitle")}</h2>
        <p>{survey.selfAnswered ? b("dash.selfDone") : b("dash.selfBody")}</p>
        <button className="button secondary" onClick={() => setSelfTest(true)}>{survey.selfAnswered ? b("dash.selfRetake") : b("dash.selfStart")} <ArrowIcon /></button>
      </section>

      <section className="bloom-card form-stack">
        <h2 className="card-title">{b("dash.settings")}</h2>
        <div className="field">
          <span>{b("setup.letters")}</span>
          <TypePicker value={letters} onChange={setLetters} />
          {letters !== survey.selfType && isPersonalityType(letters) && (
            <button className="button secondary" onClick={() => patch({ selfType: letters })}>{b("dash.lettersSave")}</button>
          )}
        </div>
        <label className="toggle-row">
          <input type="checkbox" checked={survey.status === "open"} onChange={(event) => patch({ status: event.target.checked ? "open" : "closed" })} />
          <span>{b("dash.open")}</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={survey.notify} onChange={(event) => patch({ notify: event.target.checked, locale })} />
          <span>{b("dash.notify")}</span>
        </label>
        <label className="toggle-row">
          <input type="checkbox" checked={survey.boardPublic} onChange={(event) => patch({ boardPublic: event.target.checked })} />
          <span>{b("dash.boardPublic")}</span>
        </label>
      </section>

      <section className="bloom-card privacy-card">
        <h2 className="card-title">{b("dash.privacyTitle")}</h2>
        <p>{b("dash.privacyBody")}</p>
        <p className="muted">{b("dash.signedInAs", { email: data.user.email })}</p>
        <div className="inline-actions">
          <button
            className="button danger"
            onClick={() => {
              if (window.confirm(b("dash.deleteSurveyConfirm"))) void act(() => api("/api/bloom", { method: "DELETE" }));
            }}
          >
            {b("dash.deleteSurvey")}
          </button>
          <button
            className="button danger"
            onClick={() => {
              if (window.confirm(b("dash.deleteAccountConfirm"))) void act(() => api("/api/account", { method: "DELETE" }));
            }}
          >
            {b("dash.deleteAccount")}
          </button>
        </div>
      </section>

      {error && <p className="form-error centered">{error}</p>}
      {notice && <div className="toast"><CheckIcon />{notice}</div>}
    </>
  );
}

/** The story-sized result card, rendered by the server without anyone's names. */
function ResultCard({ total, locale }: { total: number; locale: string }) {
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [error, setError] = useState("");
  // Changes with the answer count so the preview never shows a stale card.
  const src = `/api/bloom/card?locale=${locale}&n=${total}`;

  async function cardFile() {
    const response = await fetch(src);
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Something went wrong. Please try again.");
    return new File([await response.blob()], "aster-result.png", { type: "image/png" });
  }

  async function share() {
    setError("");
    try {
      const file = await cardFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined);
        return;
      }
      download(file);
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="bloom-card result-card">
      <h2 className="card-title">{b("dash.cardTitle")}</h2>
      {total < THRESHOLDS.board ? (
        <p className="muted">{b("dash.cardLocked", { threshold: THRESHOLDS.board })}</p>
      ) : (
        <>
          <p>{b("dash.cardBody")}</p>
          <img className="card-preview" src={src} alt="" width={1080} height={1920} />
          <div className="inline-actions">
            <button className="button primary" onClick={share}>{b("dash.cardShare")} <ArrowIcon /></button>
            <button
              className="button secondary"
              onClick={() => cardFile().then(download).catch((caught) => setError(errorText(caught)))}
            >
              {b("dash.cardDownload")}
            </button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </>
      )}
    </section>
  );
}
