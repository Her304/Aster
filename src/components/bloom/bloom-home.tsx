"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui";
import {
  THRESHOLDS,
  isPersonalityType,
  scoreBloom,
  type Board,
  type BloomAnswers,
  type Tiebreaks,
} from "@/lib/bloom";
import { useBloomCopy, type BloomKey } from "@/lib/bloom-i18n";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { BloomHeader, BoardView, Questionnaire, TypePicker, api, useErrorText } from "./shared";

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
    createdAt: string;
    selfAnswered: boolean;
  } | null;
  board?: Board;
  responses?: Array<{ id: string; name: string; relation: string; type: string; signedIn: boolean; submittedAt: string }>;
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
      <BloomHeader>
        {me?.user && <button className="text-button" onClick={signOut}>{b("nav.signOut")}</button>}
      </BloomHeader>
      <div className="bloom-page">{body}</div>
    </main>
  );
}

function Setup({ signedIn, onCreated }: { signedIn: boolean; onCreated: () => Promise<void> }) {
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [stage, setStage] = useState<"form" | "selfTest" | "signin" | "signinOnly">("form");
  const [displayName, setDisplayName] = useState("");
  const [selfType, setSelfType] = useState("");
  const [selfTest, setSelfTest] = useState<SelfTest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("name");
    if (prefill) setDisplayName(prefill.slice(0, 24));
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
        }),
      });
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
        {selfTest ? (
          <p className="helper-note"><CheckIcon /> {b("setup.testDone", { type: scoreBloom(selfTest.answers, selfTest.tiebreaks).type ?? "" })}</p>
        ) : (
          <button type="button" className="text-button" onClick={() => setStage("selfTest")} disabled={displayName.trim().length < 2}>
            {b("setup.unsure")}
          </button>
        )}
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
