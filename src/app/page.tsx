"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useEffect, useState } from "react";
import friendsCircle from "@/images/friends-circle.jpg";
import parkPicnic from "@/images/park-picnic.jpg";
import { SURVEY_LENGTH } from "@/lib/survey";
import { ArrowIcon, BrandMark, CheckIcon, LanguageSelect } from "@/components/ui";
import { OthersInvite } from "@/components/others-invite";
import { AccountLink } from "@/components/bloom/shared";
import { avatarColors, initials, type AssessmentData, type ResultsData, type RoomData } from "@/components/room/common";
import { RoomFlow, WaitingRoom } from "@/components/room/room-flow";
import { RoomResults } from "@/components/room/room-results";
import { I18nProvider, useI18n, type TranslationKey } from "@/lib/i18n";

type Screen = "home" | "lobby" | "flow" | "waiting" | "results";

const repositoryUrl = "https://github.com/Her304/Aster";

function BloomOrnament() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2">
        {[0, 72, 144, 216, 288].map((rotation) => (
          <ellipse key={rotation} cx="32" cy="17" rx="8.5" ry="14" transform={`rotate(${rotation} 32 32)`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="6" fill="currentColor" />
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
  const [flow, setFlow] = useState<{ data: AssessmentData; step: number } | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  /**
   * Puts this person wherever the room has them: the lobby before the host
   * starts, then their next unfinished assessment (themselves first, then each
   * friend), then the waiting room, then the results once everyone is done.
   */
  const openRoom = useCallback(
    async (code: string) => {
      const data = await request<RoomData>(`/api/rooms/${code}`);
      window.history.replaceState({}, "", `/?room=${data.room.code}`);
      if (data.room.status === "revealed") {
        const revealed = await request<ResultsData>(`/api/rooms/${data.room.code}/results`);
        setRoom(data);
        setResults(revealed);
        setScreen("results");
        return;
      }
      if (data.room.status === "lobby") {
        setRoom(data);
        setScreen("lobby");
        return;
      }
      const nextIndex = data.assessments.findIndex((item) => item.status !== "submitted");
      if (nextIndex === -1) {
        setRoom(data);
        setScreen("waiting");
        return;
      }
      const next = await request<AssessmentData>(`/api/assessments/${data.assessments[nextIndex].id}`);
      setRoom(data);
      setFlow({ data: next, step: nextIndex + 1 });
      setScreen("flow");
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
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen, flow?.data.assessment.id]);

  // The lobby and the waiting room follow the room by themselves: everyone moves
  // into the questions when the host starts, and into the results when the last person finishes.
  useEffect(() => {
    if ((screen !== "lobby" && screen !== "waiting") || !room) return;
    const code = room.room.code;
    let active = true;
    const refresh = () => {
      if (!active || document.visibilityState === "hidden") return;
      void openRoom(code).catch(() => undefined);
    };
    const interval = window.setInterval(refresh, 4_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [openRoom, room?.room.code, screen]);

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
      await openRoom(room.room.code);
    } catch (caught) {
      setError(localizedError(caught, "error.start"));
    } finally {
      setBusy(false);
    }
  }

  function leaveToHome() {
    setRoom(null);
    setFlow(null);
    setResults(null);
    setScreen("home");
    window.history.replaceState({}, "", "/");
  }

  const roomPage = screen === "flow" || screen === "waiting" || screen === "results";

  return (
    <main className={`app-shell screen-${screen}${roomPage ? " bloom-shell" : ""}`}>
      {busy && <div className="loading-line" aria-label={t("common.loading")} />}
      {screen !== "home" && room && (
        <header className="app-header">
          <button className="wordmark" onClick={() => void openRoom(room.room.code).catch(() => undefined)}>
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
      {roomPage && room && (
        <div className="bloom-page">
          {screen === "flow" && flow && (
            <RoomFlow
              key={flow.data.assessment.id}
              room={room}
              data={flow.data}
              step={flow.step}
              onFinished={() => openRoom(room.room.code)}
              onSkipDemo={() => openDemo("revealed")}
            />
          )}
          {screen === "waiting" && <WaitingRoom room={room} onSkipDemo={() => openDemo("revealed")} />}
          {screen === "results" && results && <RoomResults results={results} />}
        </div>
      )}

      {notice && <div className="toast"><CheckIcon />{notice}</div>}
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
          <AccountLink />
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
      <OthersInvite />
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
        <div className="footer-links">
          <AccountLink long />
          <SourceLink />
        </div>
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
            <span className="note-flower"><BloomOrnament /></span>
            <span className="card-kicker">{t("lobby.before")}</span>
            <h3>{t("lobby.honesty")}</h3>
            <ul><li>{t("lobby.ruleFlow", { count: SURVEY_LENGTH })}</li><li>{t("lobby.ruleNamed")}</li><li>{t("lobby.rulePrivate")}</li><li>{t("lobby.ruleReveal")}</li></ul>
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
