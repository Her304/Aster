"use client";

import { useEffect, useRef, useState } from "react";
import { TypePicker } from "@/components/bloom/shared";
import { ArrowIcon } from "@/components/ui";
import { isPersonalityType, type BloomAnswers } from "@/lib/bloom";
import { useBloomCopy } from "@/lib/bloom-i18n";
import { translateQuestion, useI18n, type TranslationKey } from "@/lib/i18n";
import { DIMENSIONS, type Dimension } from "@/lib/scoring";
import {
  SELF_TEST_LENGTH,
  SELF_TEST_PAGES,
  SELF_TEST_PAGE_SIZE,
  SELF_TEST_QUESTIONS,
  saveSelfView,
  selfTestResult,
} from "@/lib/self-test";

const responseOptions = [
  { value: 1, label: "response.strongDisagree", compact: "––" },
  { value: 2, label: "response.disagree", compact: "–" },
  { value: 3, label: "response.neither", compact: "○" },
  { value: 4, label: "response.agree", compact: "+" },
  { value: 5, label: "response.strongAgree", compact: "++" },
  { value: 0, label: "response.notSure", compact: "?" },
] satisfies Array<{ value: number; label: TranslationKey; compact: string }>;

const PROGRESS_KEY = "aster_self_test_progress";

interface Progress {
  answers: BloomAnswers;
  page: number;
}

function loadProgress(): Progress {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "null");
    if (parsed && typeof parsed.answers === "object" && Number.isInteger(parsed.page)) {
      return { answers: parsed.answers, page: Math.min(Math.max(parsed.page, 0), SELF_TEST_PAGES - 1) };
    }
  } catch {
    // Unreadable or unavailable storage: start fresh.
  }
  return { answers: {}, page: 0 };
}

function storeProgress(progress: Progress | null) {
  try {
    if (progress) window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    else window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Progress then lasts only as long as the page.
  }
}

function goToBloom(type: string, answers?: BloomAnswers) {
  saveSelfView({ type, answers });
  window.location.href = "/bloom";
}

/**
 * The /start page's "how do you see yourself?" step: tick four letters, or
 * take the 80-question test, then carry the result into a Bloom survey.
 */
export function SelfStart() {
  const b = useBloomCopy();
  const { t, locale } = useI18n();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [mode, setMode] = useState<"choose" | "test" | "result">("choose");
  const [picked, setPicked] = useState("");
  const [answers, setAnswers] = useState<BloomAnswers>({});
  const [page, setPage] = useState(0);
  const [fill, setFill] = useState("");

  useEffect(() => {
    const saved = loadProgress();
    setAnswers(saved.answers);
    setPage(saved.page);
  }, []);

  const answeredCount = SELF_TEST_QUESTIONS.filter((question) => answers[question.id] !== undefined).length;

  function show(next: typeof mode) {
    setMode(next);
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function answer(id: number, value: number) {
    setAnswers((current) => {
      const next = { ...current, [id]: value };
      storeProgress({ answers: next, page });
      return next;
    });
  }

  function turn(nextPage: number) {
    setPage(nextPage);
    storeProgress({ answers, page: nextPage });
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function finish() {
    const { letters } = selfTestResult(answers);
    setFill(DIMENSIONS.map((dimension) => letters[dimension] ?? " ").join(""));
    show("result");
  }

  function retake() {
    setAnswers({});
    setPage(0);
    storeProgress(null);
    show("test");
  }

  const dimensionLabels: Record<Dimension, { title: string; left: string; right: string }> = {
    EI: { title: t("results.social"), left: t("results.extraverted"), right: t("results.introverted") },
    SN: { title: t("results.information"), left: t("results.observant"), right: t("results.imaginative") },
    TF: { title: t("results.decisions"), left: t("results.analytical"), right: t("results.valuesLed") },
    JP: { title: t("results.structure"), left: t("results.planned"), right: t("results.flexible") },
  };

  if (mode === "test") {
    const questions = SELF_TEST_QUESTIONS.slice(page * SELF_TEST_PAGE_SIZE, (page + 1) * SELF_TEST_PAGE_SIZE);
    const lastPage = page === SELF_TEST_PAGES - 1;
    const complete = answeredCount === SELF_TEST_LENGTH;
    return (
      <section className="self-start self-start-test" ref={sectionRef}>
        <header className="self-test-head">
          <div>
            <span className="eyebrow">{b("self.part", { part: page + 1, total: SELF_TEST_PAGES })}</span>
            <h2>{b("self.prompt")}</h2>
          </div>
          <div className="self-test-progress">
            <span>{b("q.progress", { done: answeredCount, total: SELF_TEST_LENGTH })}</span>
            <div><i style={{ width: `${(answeredCount / SELF_TEST_LENGTH) * 100}%` }} /></div>
            <button className="text-button" type="button" onClick={() => show("choose")}>{b("self.close")}</button>
          </div>
        </header>
        <div className="scale-legend"><span>{t("assessment.disagree")}</span><i /><span>{t("assessment.agree")}</span><span className="legend-unsure">{t("assessment.notSure")}</span></div>
        <div className="questions-list">
          {questions.map((question, index) => {
            const number = page * SELF_TEST_PAGE_SIZE + index + 1;
            return (
              <article className="question-card" key={question.id}>
                <div className="question-copy"><span>{number}</span><p>{translateQuestion(question.id, question.text, "", true, locale)}</p></div>
                <div className="response-scale" role="radiogroup" aria-label={t("assessment.responseAria", { number })}>
                  {responseOptions.map((option, optionIndex) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${option.value === 0 ? "unsure" : ""} ${answers[question.id] === option.value ? "selected" : ""}`}
                      onClick={() => answer(question.id, option.value)}
                      role="radio"
                      aria-checked={answers[question.id] === option.value}
                      aria-label={t(option.label)}
                      title={t(option.label)}
                      tabIndex={answers[question.id] === option.value || (answers[question.id] === undefined && optionIndex === 0) ? 0 : -1}
                      onKeyDown={(event) => {
                        const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
                        if (!delta) return;
                        event.preventDefault();
                        const nextIndex = (optionIndex + delta + responseOptions.length) % responseOptions.length;
                        answer(question.id, responseOptions[nextIndex].value);
                        event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[nextIndex]?.focus();
                      }}
                    >
                      <span>{option.compact}</span><small>{option.value === 0 ? t("assessment.unsure") : option.value}</small>
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <footer className="question-footer">
          <button className="button secondary" type="button" onClick={() => turn(page - 1)} disabled={page === 0}><ArrowIcon direction="left" /> {b("self.previous")}</button>
          {lastPage ? (
            <button className="button primary" type="button" onClick={finish} disabled={!complete}>{b("self.finish")} <ArrowIcon /></button>
          ) : (
            <button className="button primary" type="button" onClick={() => turn(page + 1)}>{b("self.next")} <ArrowIcon /></button>
          )}
        </footer>
        {lastPage && !complete && <p className="submit-helper">{b("self.finishHint")}</p>}
      </section>
    );
  }

  if (mode === "result") {
    const result = selfTestResult(answers);
    const { profile } = result;
    const type = result.type ?? (isPersonalityType(fill) ? fill : null);
    return (
      <section className="self-start self-start-result" ref={sectionRef}>
        <div className="self-result-head">
          <span className="eyebrow">{b("self.resultEyebrow")}</span>
          <h2>{result.type ? b("self.resultTitle", { type: result.type }) : b("self.resultNoType")}</h2>
          {result.type ? (
            <p>{profile.closelyBalancedDimensions.length ? b("self.balanced", { dimensions: profile.closelyBalancedDimensions.join(" / ") }) : b("self.clear")}</p>
          ) : (
            <>
              <p>{b("self.resultNoTypeBody")}</p>
              <TypePicker value={fill} onChange={setFill} />
            </>
          )}
        </div>
        <div className="dimension-list">
          {DIMENSIONS.map((dimension) => {
            const labels = dimensionLabels[dimension];
            const score = profile.dimensions[dimension];
            return (
              <div className="dimension-row" key={dimension}>
                <div className="dimension-title"><span>{dimension}</span><div><strong>{labels.title}</strong>{score?.closelyBalanced && <small>{t("results.balancedShort")}</small>}</div></div>
                <div className="dimension-plot">
                  <div className="dimension-labels"><span>{labels.left}</span><span>{labels.right}</span></div>
                  <div className="dimension-track"><i className="midline" />{score && <span className="self-marker" style={{ left: `${score.score}%` }} />}</div>
                  <div className="dimension-values"><span>{t("common.self")} <strong>{score ? Math.round(score.score) : "—"}</strong></span></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="self-result-actions">
          <div>
            <button className="button primary" type="button" disabled={!type} onClick={() => type && goToBloom(type, answers)}>{b("self.ask")} <ArrowIcon /></button>
            <p>{b("self.askBody")}</p>
          </div>
          <button className="button secondary" type="button" onClick={retake}>{b("self.retake")}</button>
        </div>
        <p className="self-disclaimer">{b("self.disclaimer")}</p>
      </section>
    );
  }

  return (
    <section className="self-start" ref={sectionRef}>
      <div className="self-start-intro">
        <span className="eyebrow">{b("self.eyebrow")}</span>
        <h1>{b("self.title")}</h1>
        <p>{b("self.body")}</p>
      </div>
      <div className="self-start-options">
        <article className="self-option">
          <h3>{b("self.pickTitle")}</h3>
          <p>{b("self.pickHint")}</p>
          <TypePicker value={picked} onChange={setPicked} />
          <button className="button primary" type="button" disabled={!isPersonalityType(picked)} onClick={() => goToBloom(picked)}>
            {b("self.pickContinue", { type: isPersonalityType(picked) ? picked : "····" })} <ArrowIcon />
          </button>
        </article>
        <article className="self-option">
          <h3>{b("self.testTitle")}</h3>
          <p>{b("self.testBody")}</p>
          <button className="button primary" type="button" onClick={() => (answeredCount === SELF_TEST_LENGTH ? finish() : show("test"))}>
            {answeredCount > 0 ? b("self.testResume", { done: answeredCount, total: SELF_TEST_LENGTH }) : b("self.testStart")} <ArrowIcon />
          </button>
        </article>
      </div>
    </section>
  );
}
