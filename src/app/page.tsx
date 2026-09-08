"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import friendsCircle from "@/images/friends-circle.jpg";
import parkPicnic from "@/images/park-picnic.jpg";
import { SURVEY_LENGTH, SURVEY_QUESTIONS } from "@/lib/survey";
import {
  I18nProvider,
  localeOptions,
  translateQuestion,
  useI18n,
  type Locale,
  type TranslationKey,
} from "@/lib/i18n";

type Screen = "home" | "lobby" | "dashboard" | "assessment" | "results";
type AssessmentStatus = "not_started" | "in_progress" | "submitted";

interface RoomData {
  room: { code: string; status: "lobby" | "survey" | "revealed"; isDemo: boolean; createdAt: string };
  me: { id: string; nickname: string; isHost: boolean };
  members: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    requiredDone: number;
    requiredTotal: number;
  }>;
  assessments: Array<{
    id: string;
    targetId: string;
    targetName: string;
    isSelf: boolean;
    status: AssessmentStatus;
    answerCount: number;
  }>;
  inviteUrl: string;
}

interface AssessmentData {
  assessment: { id: string; targetName: string; isSelf: boolean; status: AssessmentStatus };
  answers: Record<number, number>;
}

interface CompactProfile {
  type: string | null;
  contributingReviewerCount: number;
  closelyBalancedDimensions: string[];
  dimensions: Record<string, { score: number; preference: string; closelyBalanced: boolean; reviewerCount: number } | null>;
}

interface ResultsData {
  people: Array<{
    id: string;
    nickname: string;
    isMe: boolean;
    overall: CompactProfile;
    self: CompactProfile | null;
    perspectives: Array<{ reviewerName: string; profile: CompactProfile }>;
  }>;
}

const responseOptions = [
  { value: 1, label: "response.strongDisagree", compact: "––" },
  { value: 2, label: "response.disagree", compact: "–" },
  { value: 3, label: "response.neither", compact: "○" },
  { value: 4, label: "response.agree", compact: "+" },
  { value: 5, label: "response.strongAgree", compact: "++" },
  { value: 0, label: "response.notSure", compact: "?" },
] satisfies Array<{ value: number; label: TranslationKey; compact: string }>;

const avatarColors = ["lilac", "moss", "clay", "sky", "butter"];

const repositoryUrl = "https://github.com/Her304/Aster";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <svg className={small ? "brand-mark small" : "brand-mark"} viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {[0, 72, 144, 216, 288].map((rotation) => (
          <ellipse key={rotation} cx="32" cy="17" rx="8.5" ry="14" transform={`rotate(${rotation} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="6" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon({ direction = "right" }: { direction?: "right" | "left" }) {
  return (
    <svg className={direction === "left" ? "icon flip" : "icon"} viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.5 7.5 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z"
      />
    </svg>
  );
}

function SourceLink() {
  const { t } = useI18n();
  return (
    <a
      className="source-link"
      href={repositoryUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={t("home.source")}
    >
      <GitHubIcon />
      <span>{t("home.source")}</span>
    </a>
  );
}

function Snapshot({
  photo,
  alt,
  caption,
  sizes,
  className = "",
  priority = false,
}: {
  photo: StaticImageData;
  alt: string;
  caption: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <figure className={`snapshot ${className}`.trim()}>
      <span className="tape" aria-hidden="true" />
      <span className="snapshot-frame">
        <Image src={photo} alt={alt} sizes={sizes} placeholder="blur" priority={priority} />
      </span>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      className="language-select"
      aria-label={t("common.language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
    >
      {localeOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function FlowerIllustration({ names }: { names?: string[] }) {
  const { t } = useI18n();
  const petalNames = names ?? [t("common.you"), ...Array.from({ length: 4 }, () => t("common.friends"))];
  return (
    <div className="flower-wrap" aria-label={t("results.petalCaption")}>
      <svg viewBox="0 0 500 500" role="img">
        <path className="flower-stem" d="M251 282C249 345 270 395 251 469" />
        <path className="flower-leaf" d="M252 392C207 356 173 364 161 398c37 11 67 8 91-6Z" />
        <path className="flower-leaf leaf-right" d="M257 430c35-35 68-36 87-9-28 20-57 23-87 9Z" />
        <g className="hero-petals">
          {[0, 72, 144, 216, 288].map((rotation, index) => (
            <g key={rotation} transform={`rotate(${rotation} 250 244)`} style={{ animationDelay: `${index * 90}ms` }}>
              <path className={`petal petal-${index}`} d="M250 239C191 212 187 137 221 92c47 24 71 94 29 147Z" />
            </g>
          ))}
        </g>
        <circle className="flower-center" cx="250" cy="244" r="43" />
        <circle className="flower-center-detail" cx="250" cy="244" r="31" />
      </svg>
      <div className="petal-notes" aria-hidden="true">
        {petalNames.slice(0, 5).map((name, index) => (
          <span key={`${name}-${index}`} className={`petal-note note-${index}`}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const progress = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{Math.round(progress)}%</strong><span>{label}</span></div>
    </div>
  );
}

function StatusPill({ status }: { status: AssessmentStatus }) {
  const { t } = useI18n();
  const labels = { not_started: t("status.notStarted"), in_progress: t("status.inProgress"), submitted: t("status.complete") };
  return <span className={`status-pill ${status}`}>{status === "submitted" && <CheckIcon />}{labels[status]}</span>;
}

export default function AsterApp() {
  return <I18nProvider><AsterAppContent /></I18nProvider>;
}

function AsterAppContent() {
  const { locale, t } = useI18n();
  const [screen, setScreen] = useState<Screen>("home");
  const [entryMode, setEntryMode] = useState<"create" | "join">("create");
  const [nickname, setNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const saveQueue = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const saveHadError = useRef(false);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const localizedError = (caught: unknown, key: TranslationKey) =>
    locale === "en" && caught instanceof Error ? caught.message : t(key);

  const request = useCallback(async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
    return data;
  }, []);

  const openRoom = useCallback(
    async (code: string, preferred?: Screen) => {
      const data = await request<RoomData>(`/api/rooms/${code}`);
      setRoom(data);
      setAssessment(null);
      setResults(null);
      const next = preferred || (data.room.status === "lobby" ? "lobby" : "dashboard");
      setScreen(next);
      window.history.replaceState({}, "", `/?room=${data.room.code}`);
    },
    [request],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invited = params.get("join");
    const roomCode = params.get("room");
    if (invited) {
      setEntryMode("join");
      setJoinCode(invited.toUpperCase());
    }
    if (roomCode) {
      setBusy(true);
      openRoom(roomCode)
        .catch(() => {
          setEntryMode("join");
          setJoinCode(roomCode.toUpperCase());
        })
        .finally(() => setBusy(false));
    }
  }, [openRoom]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (screen !== "assessment") window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  useEffect(() => {
    if (screen !== "lobby" || !room) return;
    const code = room.room.code;
    let active = true;
    const refreshLobby = () => {
      if (!active || document.visibilityState === "hidden") return;
      void openRoom(code).catch(() => undefined);
    };
    const interval = window.setInterval(refreshLobby, 4_000);
    window.addEventListener("focus", refreshLobby);
    document.addEventListener("visibilitychange", refreshLobby);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshLobby);
      document.removeEventListener("visibilitychange", refreshLobby);
    };
  }, [openRoom, room?.room.code, screen]);

  useEffect(() => {
    if (!confirmSubmit) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmSubmit(false);
      if (event.key === "Tab") {
        const modal = submitButtonRef.current?.closest(".modal");
        const focusable = Array.from(modal?.querySelectorAll<HTMLElement>("button:not(:disabled)") || []);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    submitButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [confirmSubmit]);

  async function enterRoom(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payload = entryMode === "create" ? { nickname } : { nickname, code: joinCode };
      const data = await request<{ code: string; recoveryPath: string }>(
        entryMode === "create" ? "/api/rooms" : "/api/rooms/join",
        { method: "POST", body: JSON.stringify(payload) },
      );
      localStorage.setItem(`aster_recovery_${data.code}`, data.recoveryPath);
      await openRoom(data.code);
    } catch (caught) {
      setError(localizedError(caught, "error.enter"));
    } finally {
      setBusy(false);
    }
  }

  async function openDemo(kind: "active" | "revealed") {
    setBusy(true);
    setError("");
    try {
      const data = await request<{ code: string }>("/api/demo", {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      await openRoom(data.code);
      if (kind === "revealed") await openResults(data.code);
    } catch (caught) {
      setError(localizedError(caught, "error.demo"));
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!room) return;
    await navigator.clipboard.writeText(room.inviteUrl);
    setNotice(t("notice.inviteCopied"));
  }

  async function copyRecovery() {
    if (!room) return;
    const recoveryPath = localStorage.getItem(`aster_recovery_${room.room.code}`);
    if (!recoveryPath) {
      setNotice(t("notice.recoveryUnavailable"));
      return;
    }
    await navigator.clipboard.writeText(`${window.location.origin}${recoveryPath}`);
    setNotice(t("notice.recoveryCopied"));
  }

  async function startCircle() {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      await request(`/api/rooms/${room.room.code}/start`, { method: "POST" });
      await openRoom(room.room.code, "dashboard");
    } catch (caught) {
      setError(localizedError(caught, "error.start"));
    } finally {
      setBusy(false);
    }
  }

  async function openAssessment(id: string) {
    setBusy(true);
    setError("");
    try {
      const data = await request<AssessmentData>(`/api/assessments/${id}`);
      setAssessment(data);
      const firstUnanswered = SURVEY_QUESTIONS.findIndex((question) => data.answers[question.id] === undefined);
      setPage(firstUnanswered === -1 ? 4 : Math.floor(firstUnanswered / 10));
      setScreen("assessment");
    } catch (caught) {
      setError(localizedError(caught, "error.openAssessment"));
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(questionId: number, value: number) {
    if (!assessment) return;
    const previous = assessment.answers[questionId];
    const assessmentId = assessment.assessment.id;
    setAssessment((current) =>
      current && current.assessment.id === assessmentId
        ? { ...current, answers: { ...current.answers, [questionId]: value } }
        : current,
    );
    if (pendingSaves.current === 0) saveHadError.current = false;
    pendingSaves.current += 1;
    setPendingSaveCount(pendingSaves.current);
    setSaveState("saving");
    const queuedSave = saveQueue.current.then(() =>
      request(`/api/assessments/${assessmentId}`, {
        method: "PATCH",
        body: JSON.stringify({ questionId, value }),
      }),
    );
    saveQueue.current = queuedSave.then(() => undefined, () => undefined);
    try {
      await queuedSave;
    } catch {
      saveHadError.current = true;
      setAssessment((current) => {
        if (!current || current.assessment.id !== assessmentId || current.answers[questionId] !== value) return current;
        const answers = { ...current.answers };
        if (previous === undefined) delete answers[questionId];
        else answers[questionId] = previous;
        return { ...current, answers };
      });
    } finally {
      pendingSaves.current = Math.max(0, pendingSaves.current - 1);
      setPendingSaveCount(pendingSaves.current);
      if (pendingSaves.current === 0) setSaveState(saveHadError.current ? "error" : "saved");
    }
  }

  async function submitAssessment() {
    if (!assessment || !room || pendingSaves.current > 0) return;
    setBusy(true);
    setError("");
    try {
      const outcome = await request<{ revealed: boolean }>(`/api/assessments/${assessment.assessment.id}/submit`, {
        method: "POST",
      });
      setConfirmSubmit(false);
      await openRoom(room.room.code, "dashboard");
      setNotice(outcome.revealed ? t("notice.circleComplete") : t("notice.submitted"));
    } catch (caught) {
      setError(localizedError(caught, "error.submit"));
      setConfirmSubmit(false);
    } finally {
      setBusy(false);
    }
  }

  async function openResults(code = room?.room.code) {
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      const data = await request<ResultsData>(`/api/rooms/${code}/results`);
      setResults(data);
      setScreen("results");
    } catch (caught) {
      setError(localizedError(caught, "error.resultsSealed"));
    } finally {
      setBusy(false);
    }
  }

  function leaveToHome() {
    setRoom(null);
    setAssessment(null);
    setResults(null);
    setScreen("home");
    window.history.replaceState({}, "", "/");
  }

  return (
    <main className={`app-shell screen-${screen}`}>
      {busy && <div className="loading-line" aria-label={t("common.loading")} />}
      {screen !== "home" && room && (
        <header className="app-header">
          <button className="wordmark" onClick={() => setScreen(room.room.status === "lobby" ? "lobby" : "dashboard")}>
            <BrandMark small />
            <span>{t("common.brand")}</span>
          </button>
          <div className="header-actions">
            <LanguageSelect />
            <button className="room-code" onClick={copyInvite} title={t("action.copyLink")}>
              <span>{t("common.room")}</span> {room.room.code}
            </button>
            <button className="avatar avatar-mini moss" onClick={leaveToHome} title={t("home.enterAria")}>
              {initials(room.me.nickname)}
            </button>
          </div>
        </header>
      )}

      {screen === "home" && (
        <HomeScreen
          entryMode={entryMode}
          setEntryMode={setEntryMode}
          nickname={nickname}
          setNickname={setNickname}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          enterRoom={enterRoom}
          openDemo={openDemo}
          busy={busy}
          error={error}
        />
      )}
      {screen === "lobby" && room && (
        <LobbyScreen room={room} copyInvite={copyInvite} copyRecovery={copyRecovery} startCircle={startCircle} busy={busy} error={error} />
      )}
      {screen === "dashboard" && room && (
        <DashboardScreen
          room={room}
          openAssessment={openAssessment}
          openResults={() => openResults()}
          refresh={() => openRoom(room.room.code, "dashboard")}
          openDemoResults={() => openDemo("revealed")}
          error={error}
        />
      )}
      {screen === "assessment" && assessment && room && (
        <AssessmentScreen
          data={assessment}
          page={page}
          setPage={setPage}
          saveAnswer={saveAnswer}
          saveState={saveState}
          pendingSaveCount={pendingSaveCount}
          back={() => openRoom(room.room.code, "dashboard")}
          onReviewSubmit={() => setConfirmSubmit(true)}
          error={error}
        />
      )}
      {screen === "results" && results && room && (
        <ResultsScreen results={results} back={() => setScreen("dashboard")} />
      )}

      {notice && <div className="toast"><CheckIcon />{notice}</div>}
      {confirmSubmit && assessment && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmSubmit(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="submit-title" onMouseDown={(event) => event.stopPropagation()}>
            <span className="eyebrow">{t("submit.eyebrow")}</span>
            <h2 id="submit-title">{t("submit.title")}</h2>
            <p>{t("submit.body", { name: assessment.assessment.targetName })}</p>
            <div className="modal-actions">
              <button className="button secondary" onClick={() => setConfirmSubmit(false)}>{t("action.keepReviewing")}</button>
              <button ref={submitButtonRef} className="button primary" onClick={submitAssessment} disabled={busy || pendingSaveCount > 0}>{t("action.submit")} <ArrowIcon /></button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function HomeScreen(props: {
  entryMode: "create" | "join";
  setEntryMode: (mode: "create" | "join") => void;
  nickname: string;
  setNickname: (value: string) => void;
  joinCode: string;
  setJoinCode: (value: string) => void;
  enterRoom: (event: React.FormEvent) => void;
  openDemo: (kind: "active" | "revealed") => void;
  busy: boolean;
  error: string;
}) {
  const { t } = useI18n();
  return (
    <div className="home-page">
      <nav className="home-nav">
        <div className="wordmark"><BrandMark small /><span>{t("common.brand")}</span></div>
        <span className="nav-note">{t("home.navNote")}</span>
        <div className="nav-cluster">
          <SourceLink />
          <LanguageSelect />
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{t("home.eyebrow")}</span>
          <h1>{t("home.titleA")}<br /><em>{t("home.titleB")}</em></h1>
          <p className="hero-lede">{t("home.lede")}</p>
          <div className="trust-row">
            <span><i>01</i> {t("home.trustInvite")}</span>
            <span><i>02</i> {t("home.trustAnswer")}</span>
            <span><i>03</i> {t("home.trustReveal")}</span>
          </div>
          <span className="hero-scrawl" aria-hidden="true">✳</span>
        </div>
        <div className="hero-art">
          <Snapshot
            photo={parkPicnic}
            alt={t("home.snapAlt")}
            caption={t("home.snapCaption")}
            sizes="(max-width: 780px) 88vw, (max-width: 1120px) 42vw, 30vw"
            priority
          />
        </div>
        <form className="entry-card" onSubmit={props.enterRoom}>
          <div className="entry-tabs" role="tablist" aria-label={t("home.enterAria")}>
            <button type="button" role="tab" aria-selected={props.entryMode === "create"} onClick={() => props.setEntryMode("create")}>{t("home.createTab")}</button>
            <button type="button" role="tab" aria-selected={props.entryMode === "join"} onClick={() => props.setEntryMode("join")}>{t("home.joinTab")}</button>
          </div>
          <div className="entry-content">
            <div>
              <span className="card-kicker">{props.entryMode === "create" ? t("home.newCircle") : t("home.friendsWaiting")}</span>
              <h2>{props.entryMode === "create" ? t("home.gather") : t("home.stepIn")}</h2>
            </div>
            {props.entryMode === "join" && (
              <label className="field">
                <span>{t("home.roomCode")}</span>
                <input className="code-input" value={props.joinCode} onChange={(event) => props.setJoinCode(event.target.value.toUpperCase().slice(0, 6))} placeholder={t("home.roomPlaceholder")} autoComplete="off" required />
              </label>
            )}
            <label className="field">
              <span>{t("home.nickname")}</span>
              <input value={props.nickname} onChange={(event) => props.setNickname(event.target.value)} placeholder={t("home.nicknamePlaceholder")} autoComplete="nickname" required minLength={2} maxLength={24} />
            </label>
            {props.error && <p className="form-error">{props.error}</p>}
            <button className="button primary wide" disabled={props.busy}>
              {props.entryMode === "create" ? t("home.create") : t("home.join")} <ArrowIcon />
            </button>
            <p className="privacy-micro">{t("home.consent")}</p>
          </div>
        </form>
      </section>
      <section className="sample-strip">
        <p><span className="spark">✣</span> {t("home.samplePrompt")}</p>
        <div>
          <button onClick={() => props.openDemo("active")} disabled={props.busy}>{t("home.sampleCircle")} <ArrowIcon /></button>
          <button onClick={() => props.openDemo("revealed")} disabled={props.busy}>{t("home.sampleReveal")}</button>
        </div>
      </section>
      <section className="how-it-works">
        <div className="how-intro">
          <span className="eyebrow">{t("home.howEyebrow")}</span>
          <h2>{t("home.howTitle")}</h2>
          <Snapshot
            photo={friendsCircle}
            alt={t("home.circleAlt")}
            caption={t("home.circleCaption")}
            sizes="(max-width: 780px) 82vw, 30vw"
            className="snapshot-pinned"
          />
        </div>
        <div className="steps-grid">
          <article><span>01</span><h3>{t("home.gatherTitle")}</h3><p>{t("home.gatherBody")}</p></article>
          <article><span>02</span><h3>{t("home.reflectTitle")}</h3><p>{t("home.reflectBody")}</p></article>
          <article><span>03</span><h3>{t("home.revealTitle")}</h3><p>{t("home.revealBody")}</p></article>
        </div>
      </section>
      <footer className="home-footer">
        <div className="footer-brand">
          <div className="wordmark"><BrandMark small /><span>{t("common.brand")}</span></div>
          <p className="footer-note">{t("home.footerNote")}</p>
        </div>
        <p className="footer-disclaimer">{t("home.disclaimer")}</p>
        <SourceLink />
      </footer>
    </div>
  );
}

function LobbyScreen({ room, copyInvite, copyRecovery, startCircle, busy, error }: { room: RoomData; copyInvite: () => void; copyRecovery: () => void; startCircle: () => void; busy: boolean; error: string }) {
  const { t } = useI18n();
  const peopleLabel = t(room.members.length === 1 ? "common.person" : "common.people");
  return (
    <div className="page-container lobby-page">
      <section className="page-intro centered">
        <span className="eyebrow">{t("lobby.eyebrow")}</span>
        <h1>{t("lobby.welcome", { name: room.me.nickname })}</h1>
        <p>{room.me.isHost ? t("lobby.hostIntro") : t("lobby.guestIntro")}</p>
      </section>
      <div className="lobby-grid">
        <section className="panel member-panel">
          <div className="panel-heading"><div><span className="card-kicker">{t("lobby.inRoom")}</span><h2>{t("lobby.count", { count: room.members.length, people: peopleLabel })}</h2></div><span className="live-dot">{t("common.live")}</span></div>
          <div className="member-list">
            {room.members.map((member, index) => (
              <div className="member-row" key={member.id}>
                <span className={`avatar ${avatarColors[index % avatarColors.length]}`}>{initials(member.nickname)}</span>
                <div><strong>{member.nickname}{member.id === room.me.id && ` · ${t("common.you")}`}</strong><span>{member.isHost ? t("common.host") : t("lobby.readyReflect")}</span></div>
                <CheckIcon />
              </div>
            ))}
          </div>
          <div className="invite-box">
            <div><span>{t("lobby.inviteLink")}</span><strong>{room.inviteUrl.replace(/^https?:\/\//, "")}</strong></div>
            <button onClick={copyInvite}>{t("action.copyLink")}</button>
          </div>
        </section>
        <aside className="lobby-aside">
          <div className="panel botanical-note">
            <span className="note-flower"><BrandMark /></span>
            <span className="card-kicker">{t("lobby.before")}</span>
            <h3>{t("lobby.honesty")}</h3>
            <ul><li>{t("lobby.ruleNamed")}</li><li>{t("lobby.rulePrivate")}</li><li>{t("lobby.ruleReveal")}</li></ul>
          </div>
          {error && <p className="form-error">{error}</p>}
          {room.me.isHost ? (
            <button className="button primary wide large" onClick={startCircle} disabled={busy || room.members.length < 2}>{t("lobby.start")} <ArrowIcon /></button>
          ) : (
            <div className="waiting-note"><span className="pulse" />{t("lobby.waitHost")}</div>
          )}
          {!room.room.isDemo && <button className="button secondary wide" onClick={copyRecovery}>{t("action.copyLink")}</button>}
          {room.members.length < 2 && room.me.isHost && <p className="helper centered">{t("lobby.needFriend")}</p>}
        </aside>
      </div>
    </div>
  );
}

function DashboardScreen({ room, openAssessment, openResults, refresh, openDemoResults, error }: { room: RoomData; openAssessment: (id: string) => void; openResults: () => void; refresh: () => void; openDemoResults: () => void; error: string }) {
  const { t } = useI18n();
  const friendAssessments = room.assessments.filter((item) => !item.isSelf);
  const selfAssessment = room.assessments.find((item) => item.isSelf);
  const answered = friendAssessments.reduce((sum, item) => sum + item.answerCount, 0);
  const total = friendAssessments.length * SURVEY_LENGTH;
  const completed = friendAssessments.filter((item) => item.status === "submitted").length;
  const allMineComplete = completed === friendAssessments.length;
  const roomRequired = room.members.reduce((sum, member) => sum + member.requiredTotal, 0);
  const roomDone = room.members.reduce((sum, member) => sum + member.requiredDone, 0);

  return (
    <div className="page-container dashboard-page">
      <section className="dashboard-hero">
        <div><span className="eyebrow">{t("dashboard.eyebrow")}</span><h1>{room.room.status === "revealed" ? t("dashboard.openTitle") : t("dashboard.greeting", { name: room.me.nickname })}</h1><p>{room.room.status === "revealed" ? t("dashboard.openBody") : t("dashboard.activeBody")}</p></div>
        <ProgressRing value={room.room.status === "revealed" ? 100 : total ? (answered / total) * 100 : 0} label={room.room.status === "revealed" ? t("common.ready") : t("dashboard.progress")} />
      </section>

      {room.room.status === "revealed" && (
        <section className="reveal-banner">
          <div className="mini-bloom"><BrandMark /></div>
          <div><span className="eyebrow">{t("dashboard.petals")}</span><h2>{t("dashboard.resultsReady")}</h2><p>{t("dashboard.resultsBody")}</p></div>
          <button className="button ink" onClick={openResults}>{t("dashboard.openResults")} <ArrowIcon /></button>
        </section>
      )}

      <section className="section-block">
        <div className="section-heading"><div><span className="card-kicker">{t("dashboard.required", { done: completed, total: friendAssessments.length })}</span><h2>{t("dashboard.friendsQuestion")}</h2></div><span className="autosave-note">{t("status.autoSave")}</span></div>
        <div className="assessment-grid">
          {friendAssessments.map((item, index) => (
            <button className={`assessment-card ${item.status}`} key={item.id} onClick={() => item.status !== "submitted" && openAssessment(item.id)} disabled={item.status === "submitted"}>
              <div className="assessment-card-top"><span className={`avatar ${avatarColors[(index + 1) % avatarColors.length]}`}>{initials(item.targetName)}</span><StatusPill status={item.status} /></div>
              <div><h3>{item.targetName}</h3><p>{item.status === "submitted" ? t("dashboard.perspectiveShared") : t("dashboard.answerCount", { done: item.answerCount, total: SURVEY_LENGTH })}</p></div>
              <div className="card-progress"><i style={{ width: `${(item.answerCount / SURVEY_LENGTH) * 100}%` }} /></div>
              {item.status !== "submitted" && <span className="card-action">{item.status === "not_started" ? t("action.begin") : t("action.continue")} <ArrowIcon /></span>}
            </button>
          ))}
        </div>
      </section>

      {selfAssessment && (
        <section className="self-card">
          <div className="self-ornament"><BrandMark /></div>
          <div><span className="card-kicker">{t("dashboard.optional")}</span><h2>{t("dashboard.selfQuestion")}</h2><p>{t("dashboard.selfBody")}</p></div>
          <div className="self-actions"><StatusPill status={selfAssessment.status} />{selfAssessment.status !== "submitted" && <button className="button secondary" onClick={() => openAssessment(selfAssessment.id)}>{selfAssessment.answerCount ? t("action.continue") : t("dashboard.selfBegin")} <ArrowIcon /></button>}</div>
        </section>
      )}

      <section className="room-progress panel">
        <div className="section-heading compact"><div><span className="card-kicker">{t("dashboard.roomProgress")}</span><h2>{t("dashboard.sharedCount", { done: roomDone, total: roomRequired })}</h2></div><button className="text-button" onClick={refresh}>{t("action.refresh")}</button></div>
        <div className="room-progress-bar"><i style={{ width: `${roomRequired ? (roomDone / roomRequired) * 100 : 0}%` }} /></div>
        <div className="room-member-progress">
          {room.members.map((member, index) => (
            <div key={member.id}><span className={`avatar avatar-small ${avatarColors[index % avatarColors.length]}`}>{initials(member.nickname)}</span><span><strong>{member.nickname}</strong><small>{t("dashboard.memberDone", { done: member.requiredDone, total: member.requiredTotal })}</small></span>{member.requiredDone === member.requiredTotal ? <CheckIcon /> : <span className="tiny-progress">{member.requiredTotal ? Math.round((member.requiredDone / member.requiredTotal) * 100) : 0}%</span>}</div>
          ))}
        </div>
        {allMineComplete && room.room.status !== "revealed" && <p className="waiting-copy"><span className="pulse" /> {t("dashboard.mineDone")}</p>}
      </section>
      {room.room.isDemo && room.room.status !== "revealed" && (
        <button className="demo-results-link" onClick={openDemoResults}>{t("dashboard.skipDemo")} <ArrowIcon /></button>
      )}
      {error && <p className="form-error centered">{error}</p>}
    </div>
  );
}

function AssessmentScreen({ data, page, setPage, saveAnswer, saveState, pendingSaveCount, back, onReviewSubmit, error }: { data: AssessmentData; page: number; setPage: (page: number) => void; saveAnswer: (questionId: number, value: number) => void; saveState: "saved" | "saving" | "error"; pendingSaveCount: number; back: () => void; onReviewSubmit: () => void; error: string }) {
  const { locale, t } = useI18n();
  const questions = SURVEY_QUESTIONS.slice(page * 10, page * 10 + 10);
  const answeredCount = Object.keys(data.answers).length;
  const pageAnswered = questions.filter((question) => data.answers[question.id] !== undefined).length;
  const lastPage = page === Math.ceil(SURVEY_LENGTH / 10) - 1;

  function nextPage() {
    setPage(Math.min(4, page + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function previousPage() {
    setPage(Math.max(0, page - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="assessment-page">
      <aside className="assessment-sidebar">
        <button className="back-link" onClick={back}><ArrowIcon direction="left" /> {t("action.saveLeave")}</button>
        <div className="assessing-person"><span className="avatar lilac">{initials(data.assessment.targetName)}</span><span className="card-kicker">{data.assessment.isSelf ? t("assessment.self") : t("assessment.friend")}</span><h1>{data.assessment.targetName}</h1><p>{data.assessment.isSelf ? t("assessment.selfHint") : t("assessment.friendHint")}</p></div>
        <div className="side-progress"><span>{t("assessment.answered", { done: answeredCount, total: SURVEY_LENGTH })}</span><div><i style={{ width: `${(answeredCount / SURVEY_LENGTH) * 100}%` }} /></div></div>
        <div className="privacy-seal"><span>✣</span><p><strong>{t("assessment.privateTitle")}</strong> {t("assessment.privateBody")}</p></div>
      </aside>
      <section className="question-area">
        <header className="question-header">
          <div><span className="eyebrow">{t("assessment.part", { part: page + 1, total: 5 })}</span><h2>{t("assessment.notice")}</h2></div>
          <div className={`save-state ${saveState}`}><span />{saveState === "saving" ? t("status.saving") : saveState === "error" ? t("status.notSaved") : t("status.saved")}</div>
        </header>
        <div className="scale-legend"><span>{t("assessment.disagree")}</span><i /><span>{t("assessment.agree")}</span><span className="legend-unsure">{t("assessment.notSure")}</span></div>
        <div className="questions-list">
          {questions.map((question, index) => (
            <article className="question-card" key={question.id}>
              <div className="question-copy"><span>{page * 10 + index + 1}</span><p>{translateQuestion(question.id, question.text, data.assessment.targetName, data.assessment.isSelf, locale)}</p></div>
              <div className="response-scale" role="radiogroup" aria-label={t("assessment.responseAria", { number: page * 10 + index + 1 })}>
                {responseOptions.map((option, optionIndex) => (
                  <button
                    key={option.value}
                    className={`${option.value === 0 ? "unsure" : ""} ${data.answers[question.id] === option.value ? "selected" : ""}`}
                    onClick={() => saveAnswer(question.id, option.value)}
                    role="radio"
                    aria-checked={data.answers[question.id] === option.value}
                    aria-label={t(option.label)}
                    title={t(option.label)}
                    tabIndex={data.answers[question.id] === option.value || (data.answers[question.id] === undefined && optionIndex === 0) ? 0 : -1}
                    onKeyDown={(event) => {
                      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                      if (!delta) return;
                      event.preventDefault();
                      const nextIndex = (optionIndex + delta + responseOptions.length) % responseOptions.length;
                      saveAnswer(question.id, responseOptions[nextIndex].value);
                      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
                    }}
                  >
                    <span>{option.compact}</span><small>{option.value === 0 ? t("assessment.unsure") : option.value}</small>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
        {error && <p className="form-error">{error}</p>}
        <footer className="question-footer">
          <button className="button secondary" onClick={previousPage} disabled={page === 0}><ArrowIcon direction="left" /> {t("action.previous")}</button>
          <span>{t("assessment.answeredHere", { done: pageAnswered })}</span>
          {lastPage ? (
            <button className="button primary" onClick={onReviewSubmit} disabled={answeredCount !== SURVEY_LENGTH || pendingSaveCount > 0}>{t("action.reviewSubmit")} <ArrowIcon /></button>
          ) : (
            <button className="button primary" onClick={nextPage}>{t("action.nextTen")} <ArrowIcon /></button>
          )}
        </footer>
        {lastPage && answeredCount !== SURVEY_LENGTH && <p className="submit-helper">{t("assessment.submitHint", { total: SURVEY_LENGTH })}</p>}
      </section>
    </div>
  );
}

function ResultsScreen({ results, back }: { results: ResultsData; back: () => void }) {
  const { t } = useI18n();
  const me = results.people.find((person) => person.isMe)!;
  const dimensionLabels: Record<string, { title: string; left: string; right: string }> = {
    EI: { title: t("results.social"), left: t("results.extraverted"), right: t("results.introverted") },
    SN: { title: t("results.information"), left: t("results.observant"), right: t("results.imaginative") },
    TF: { title: t("results.decisions"), left: t("results.analytical"), right: t("results.valuesLed") },
    JP: { title: t("results.structure"), left: t("results.planned"), right: t("results.flexible") },
  };
  const variations = Object.keys(dimensionLabels).flatMap((dimension) => {
    const scores = me.perspectives
      .map((perspective) => perspective.profile.dimensions[dimension]?.score)
      .filter((score): score is number => score !== undefined);
    return scores.length ? [{ dimension, range: Math.max(...scores) - Math.min(...scores) }] : [];
  }).sort((a, b) => a.range - b.range);
  const mostAgreed = variations[0];
  const mostVaried = variations[variations.length - 1];
  const formatScores = (profile: CompactProfile) => ["EI", "SN", "TF", "JP"]
    .map((dimension) => `${dimension} ${profile.dimensions[dimension] ? Math.round(profile.dimensions[dimension]!.score) : "—"}`)
    .join(" · ");

  return (
    <div className="results-page">
      <div className="results-hero">
        <div className="results-hero-copy">
          <button className="back-link light" onClick={back}><ArrowIcon direction="left" /> {t("action.backRoom")}</button>
          <span className="eyebrow">{t("results.reflection", { name: me.nickname })}</span>
          <h1>{me.overall.type ? t("results.headline", { type: me.overall.type }) : t("results.insufficientHeadline")}</h1>
          <p>{!me.overall.type ? t("results.insufficientBody") : me.overall.closelyBalancedDimensions.length ? t("results.balanced", { dimensions: me.overall.closelyBalancedDimensions.join(" / ") }) : t("results.clear")}</p>
          <div className="result-meta"><span><strong>{me.perspectives.length}</strong> {t("results.friendCount")}</span><span><strong>50</strong> {t("results.signals")}</span><span><strong>1</strong> {t("results.portrait")}</span></div>
        </div>
        <div className="result-flower-card">
          <FlowerIllustration names={me.perspectives.map((item) => item.reviewerName)} />
          <span className="flower-caption">{t("results.petalCaption")}</span>
        </div>
      </div>

      <div className="results-content">
        <section className="result-section dimension-section">
          <div className="section-heading"><div><span className="eyebrow">{t("results.dimensions")}</span><h2>{t("results.compare")}</h2></div><div className="bar-key"><span className="friends-key">{t("common.friends")}</span>{me.self && <span className="self-key">{t("common.self")}</span>}</div></div>
          <div className="dimension-list">
            {Object.entries(dimensionLabels).map(([dimension, labels]) => {
              const friendDimension = me.overall.dimensions[dimension];
              const friendScore = friendDimension?.score;
              const selfScore = me.self?.dimensions[dimension]?.score;
              return (
                <div className="dimension-row" key={dimension}>
                  <div className="dimension-title"><span>{dimension}</span><div><strong>{labels.title}</strong>{friendDimension?.closelyBalanced && <small>{t("results.balancedShort")}</small>}</div></div>
                  <div className="dimension-plot">
                    <div className="dimension-labels"><span>{labels.left}</span><span>{labels.right}</span></div>
                    <div className="dimension-track"><i className="midline" />{friendScore !== undefined && <span className="friend-marker" style={{ left: `${friendScore}%` }} title={`${t("common.friends")}: ${friendScore}`} />}{selfScore !== undefined && <span className="self-marker" style={{ left: `${selfScore}%` }} title={`${t("common.self")}: ${selfScore}`} />}</div>
                    <div className="dimension-values"><span>{t("common.friends")} <strong>{friendScore === undefined ? "—" : Math.round(friendScore)}</strong></span>{me.self && <span>{t("common.self")} <strong>{selfScore === undefined ? "—" : Math.round(selfScore)}</strong></span>}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {mostAgreed && mostVaried && <div className="insight-grid">
          <article className="insight-card agree"><span className="insight-symbol">✣</span><span className="card-kicker">{t("results.align")}</span><h3>{dimensionLabels[mostAgreed.dimension].title}</h3><p>{t("results.alignBody", { range: Math.round(mostAgreed.range) })}</p></article>
          <article className="insight-card differ"><span className="insight-symbol">↝</span><span className="card-kicker">{t("results.nuance")}</span><h3>{dimensionLabels[mostVaried.dimension].title}</h3><p>{t("results.nuanceBody", { range: Math.round(mostVaried.range) })}</p></article>
        </div>}

        <section className="result-section perspectives-section">
          <div className="section-heading"><div><span className="eyebrow">{t("results.petalByPetal")}</span><h2>{t("results.every")}</h2></div><p>{t("results.scoreMethod")}</p></div>
          <div className="perspective-table">
            {me.perspectives.map((perspective, index) => (
              <div key={perspective.reviewerName}><span className={`avatar ${avatarColors[index % avatarColors.length]}`}>{initials(perspective.reviewerName)}</span><span><strong>{perspective.reviewerName}</strong><small>{t("results.seesAs")}</small></span><b>{perspective.profile.type || "—"}</b><button title={t("results.exactScores")} aria-label={`${t("results.exactScores")}: ${perspective.reviewerName}`}>{formatScores(perspective.profile)}</button></div>
            ))}
            {me.self && <div className="self-perspective"><span className="avatar ink">{initials(me.nickname)}</span><span><strong>{t("common.self")}</strong><small>{t("results.selfSeesAs")}</small></span><b>{me.self.type || "—"}</b><button aria-label={t("results.exactScores")}>{formatScores(me.self)}</button></div>}
          </div>
        </section>

        <section className="room-summary">
          <div><span className="eyebrow">{t("results.aroundRoom")}</span><h2>{t("results.circleBloom")}</h2><p>{t("results.summaryPrivacy")}</p></div>
          <div className="type-garden">{results.people.map((person, index) => <article key={person.id}><span className={`avatar ${avatarColors[index % avatarColors.length]}`}>{initials(person.nickname)}</span><div><strong>{person.nickname}{person.isMe && ` · ${t("common.you")}`}</strong><span>{t("results.perspectiveCount", { count: person.overall.contributingReviewerCount })}</span></div><b>{person.overall.type || "—"}</b></article>)}</div>
        </section>
        <p className="disclaimer">{t("results.disclaimer")}</p>
      </div>
    </div>
  );
}
