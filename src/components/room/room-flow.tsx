"use client";

import { useRef, useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui";
import { useBloomCopy } from "@/lib/bloom-i18n";
import { translateQuestion, useI18n, type TranslationKey } from "@/lib/i18n";
import { SURVEY_LENGTH, SURVEY_QUESTIONS } from "@/lib/survey";
import { avatarColors, initials, type AssessmentData, type RoomData } from "./common";

const responseOptions: Array<{ value: number; label: TranslationKey }> = [
  { value: 5, label: "response.strongAgree" },
  { value: 4, label: "response.agree" },
  { value: 3, label: "response.neither" },
  { value: 2, label: "response.disagree" },
  { value: 1, label: "response.strongDisagree" },
  { value: 0, label: "response.notSure" },
];

async function send(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

function firstUnanswered(answers: Record<number, number>) {
  const index = SURVEY_QUESTIONS.findIndex((question) => answers[question.id] === undefined);
  return index === -1 ? SURVEY_LENGTH - 1 : index;
}

/** Where this person is in the room's fixed order: themselves, then each friend. */
function StepList({ room, current }: { room: RoomData; current: string }) {
  const { t } = useI18n();
  return (
    <ol className="flow-steps">
      {room.assessments.map((item, index) => (
        <li key={item.id} className={item.id === current ? "current" : item.status === "submitted" ? "done" : ""}>
          <span className={`avatar avatar-small ${avatarColors[index % avatarColors.length]}`}>{initials(item.targetName)}</span>
          <span>{item.isSelf ? t("common.you") : item.targetName}</span>
          {item.status === "submitted" && <CheckIcon />}
        </li>
      ))}
    </ol>
  );
}

/**
 * One person's thirty statements, one per screen, the way the open-link survey
 * asks them. Each answer saves as it is chosen; the last one submits and hands
 * over to whoever is next.
 */
export function RoomFlow({
  room,
  data,
  step,
  onFinished,
  onSkipDemo,
}: {
  room: RoomData;
  data: AssessmentData;
  step: number;
  onFinished: () => Promise<void>;
  onSkipDemo: () => void;
}) {
  const { locale, t } = useI18n();
  const b = useBloomCopy();
  const { assessment } = data;
  const name = assessment.targetName;
  const [answers, setAnswers] = useState<Record<number, number>>(data.answers);
  const [stage, setStage] = useState<"intro" | "questions" | "sending">("intro");
  const [index, setIndex] = useState(() => firstUnanswered(data.answers));
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const queue = useRef(Promise.resolve());
  const failed = useRef(false);

  const answered = SURVEY_QUESTIONS.filter((question) => answers[question.id] !== undefined).length;
  const localized = (caught: unknown) => (locale === "en" && caught instanceof Error ? caught.message : b("err.generic"));

  async function submit() {
    setStage("sending");
    setSubmitError("");
    await queue.current;
    if (failed.current) return;
    try {
      await send(`/api/assessments/${assessment.id}/submit`, { method: "POST" });
      await onFinished();
    } catch (caught) {
      setSubmitError(localized(caught));
    }
  }

  function choose(value: number) {
    const question = SURVEY_QUESTIONS[index];
    const previous = answers[question.id];
    const position = index;
    setAnswers((current) => ({ ...current, [question.id]: value }));
    setError("");
    failed.current = false;
    const saving = queue.current.then(() =>
      send(`/api/assessments/${assessment.id}`, { method: "PATCH", body: JSON.stringify({ questionId: question.id, value }) }),
    );
    queue.current = saving.then(
      () => undefined,
      () => {
        failed.current = true;
        setAnswers((current) => {
          const next = { ...current };
          if (previous === undefined) delete next[question.id];
          else next[question.id] = previous;
          return next;
        });
        setError(t("flow.saveError"));
        setIndex(position);
        setStage("questions");
      },
    );
    if (position < SURVEY_LENGTH - 1) setIndex(position + 1);
    else void submit();
  }

  if (stage === "intro") {
    return (
      <>
        <section className="bloom-hero">
          <span className="eyebrow">{t("flow.step", { step, total: room.assessments.length })}</span>
          <h1>{assessment.isSelf ? t("flow.selfTitle") : t("flow.friendTitle", { name })}</h1>
          <p>{assessment.isSelf ? t("flow.selfBody", { count: SURVEY_LENGTH }) : t("flow.friendBody", { count: SURVEY_LENGTH, name })}</p>
        </section>
        <section className="bloom-card">
          <StepList room={room} current={assessment.id} />
          <button className="button primary wide" onClick={() => (answered === SURVEY_LENGTH ? void submit() : setStage("questions"))}>
            {answered > 0 ? t("flow.resume") : t("flow.start")} <ArrowIcon />
          </button>
        </section>
        {room.room.isDemo && <button className="demo-results-link" onClick={onSkipDemo}>{t("flow.skipDemo")} <ArrowIcon /></button>}
      </>
    );
  }

  if (stage === "sending") {
    return (
      <section className="bloom-card centered">
        {submitError ? (
          <>
            <p className="form-error">{submitError}</p>
            <button className="button primary" onClick={() => void submit()}>{t("flow.retry")} <ArrowIcon /></button>
          </>
        ) : (
          <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>
        )}
      </section>
    );
  }

  const question = SURVEY_QUESTIONS[index];
  return (
    <section className="bloom-card q-screen" aria-live="polite">
      <div className="q-top">
        <button className="back-link" onClick={() => (index === 0 ? setStage("intro") : setIndex(index - 1))}>
          <ArrowIcon direction="left" /> {b("q.back")}
        </button>
        <span className="card-kicker">{assessment.isSelf ? b("q.aboutSelf") : b("q.aboutFriend", { name })}</span>
        <span className="q-count">{b("q.progress", { done: index + 1, total: SURVEY_LENGTH })}</span>
      </div>
      <div className="q-progress"><i style={{ width: `${(answered / SURVEY_LENGTH) * 100}%` }} /></div>
      <p className="q-text">{translateQuestion(question.id, question.text, name, assessment.isSelf, locale)}</p>
      <div className="q-options" role="radiogroup">
        {responseOptions.map((option) => (
          <button
            key={option.value}
            role="radio"
            aria-checked={answers[question.id] === option.value}
            className={`q-option ${option.value === 0 ? "unsure" : ""} ${answers[question.id] === option.value ? "selected" : ""}`}
            onClick={() => choose(option.value)}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

/** For whoever finishes first: everyone's progress, until the last person is done and the results open for all. */
export function WaitingRoom({ room, onSkipDemo }: { room: RoomData; onSkipDemo: () => void }) {
  const { t } = useI18n();
  const finished = room.members.filter((member) => member.requiredTotal > 0 && member.requiredDone === member.requiredTotal).length;
  return (
    <>
      <section className="bloom-hero">
        <span className="eyebrow">{t("wait.eyebrow")}</span>
        <h1>{t("wait.title", { name: room.me.nickname })}</h1>
        <p>{t("wait.body")}</p>
      </section>
      <section className="bloom-card">
        <div className="waiting-head">
          <strong>{t("wait.progress", { done: finished, total: room.members.length })}</strong>
          <span className="live-dot">{t("common.live")}</span>
        </div>
        <div className="q-progress"><i style={{ width: `${room.members.length ? (finished / room.members.length) * 100 : 0}%` }} /></div>
        <ul className="response-list room-list">
          {room.members.map((member, index) => {
            const done = member.requiredTotal > 0 && member.requiredDone === member.requiredTotal;
            return (
              <li key={member.id}>
                <div>
                  <strong>{member.nickname}{member.id === room.me.id && ` · ${t("common.you")}`}</strong>
                  <small>{done ? t("wait.done") : t("wait.member", { done: member.requiredDone, total: member.requiredTotal })}</small>
                </div>
                <span className={`avatar avatar-small ${avatarColors[index % avatarColors.length]}`}>{initials(member.nickname)}</span>
                {done ? <CheckIcon /> : <span className="pulse" />}
              </li>
            );
          })}
        </ul>
      </section>
      {room.room.isDemo && <button className="demo-results-link" onClick={onSkipDemo}>{t("flow.skipDemo")} <ArrowIcon /></button>}
    </>
  );
}
