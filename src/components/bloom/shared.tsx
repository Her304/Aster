"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import { ArrowIcon, BrandMark, LanguageSelect } from "@/components/ui";
import {
  AXIS_POLES,
  BLOOM_LENGTH,
  BLOOM_QUESTIONS,
  undecidedAxes,
  type Badge,
  type Board,
  type BloomAnswers,
  type Flower,
  type Tiebreaks,
} from "@/lib/bloom";
import { useBloomCopy, type BloomKey } from "@/lib/bloom-i18n";
import { translateQuestion, useI18n, type TranslationKey } from "@/lib/i18n";
import type { Dimension } from "@/lib/scoring";
import blueIris from "@/images/flowers/blue-iris.webp";
import globeAmaranth from "@/images/flowers/globe-amaranth.webp";
import hydrangea from "@/images/flowers/hydrangea.webp";
import iris from "@/images/flowers/iris.webp";

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly body: Record<string, unknown>) {
    super(message);
  }
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.error || "Something went wrong. Please try again.", response.status, body);
  return body as T;
}

/** Server messages are English; other languages get the translated generic message. */
export function useErrorText() {
  const { locale } = useI18n();
  const b = useBloomCopy();
  return useCallback(
    (caught: unknown) => (locale === "en" && caught instanceof Error ? caught.message : b("err.generic")),
    [b, locale],
  );
}

export function BloomHeader({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="app-header">
      <Link className="wordmark" href="/">
        <BrandMark small />
        <span>{t("common.brand")}</span>
      </Link>
      <div className="header-actions">
        <LanguageSelect />
        {children}
      </div>
    </header>
  );
}

const responseOptions: Array<{ value: number; label: TranslationKey }> = [
  { value: 5, label: "response.strongAgree" },
  { value: 4, label: "response.agree" },
  { value: 3, label: "response.neither" },
  { value: 2, label: "response.disagree" },
  { value: 1, label: "response.strongDisagree" },
  { value: 0, label: "response.notSure" },
];

/** Sixteen questions, one per screen, then an either-or for any axis the answers leave undecided. */
export function Questionnaire({
  name,
  self,
  onDone,
  onCancel,
}: {
  name: string;
  self: boolean;
  onDone: (answers: BloomAnswers, tiebreaks: Tiebreaks) => void;
  onCancel: () => void;
}) {
  const { locale, t } = useI18n();
  const b = useBloomCopy();
  const [answers, setAnswers] = useState<BloomAnswers>({});
  const [tiebreaks, setTiebreaks] = useState<Tiebreaks>({});
  const [index, setIndex] = useState(0);

  function settle(nextAnswers: BloomAnswers, nextTies: Tiebreaks) {
    const undecided = undecidedAxes(nextAnswers);
    setIndex(BLOOM_LENGTH);
    if (undecided.every((dimension) => nextTies[dimension])) {
      onDone(nextAnswers, Object.fromEntries(undecided.map((dimension) => [dimension, nextTies[dimension]])));
    }
  }

  function choose(value: number) {
    const question = BLOOM_QUESTIONS[index];
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    if (index < BLOOM_LENGTH - 1) setIndex(index + 1);
    else settle(next, tiebreaks);
  }

  function back() {
    if (index === 0) onCancel();
    else setIndex(Math.min(index, BLOOM_LENGTH) - 1);
  }

  const pendingTie: Dimension | undefined =
    index >= BLOOM_LENGTH ? undecidedAxes(answers).find((dimension) => !tiebreaks[dimension]) : undefined;
  const done = Math.min(index, BLOOM_LENGTH);

  return (
    <section className="bloom-card q-screen" aria-live="polite">
      <div className="q-top">
        <button className="back-link" onClick={back}><ArrowIcon direction="left" /> {b("q.back")}</button>
        <span className="card-kicker">{self ? b("q.aboutSelf") : b("q.aboutFriend", { name })}</span>
        <span className="q-count">{b("q.progress", { done: done + (index < BLOOM_LENGTH ? 1 : 0), total: BLOOM_LENGTH })}</span>
      </div>
      <div className="q-progress"><i style={{ width: `${(done / BLOOM_LENGTH) * 100}%` }} /></div>
      {index < BLOOM_LENGTH ? (
        <>
          <p className="q-text">
            {translateQuestion(BLOOM_QUESTIONS[index].id, BLOOM_QUESTIONS[index].text, name, self, locale)}
          </p>
          <div className="q-options" role="radiogroup">
            {responseOptions.map((option) => (
              <button
                key={option.value}
                role="radio"
                aria-checked={answers[BLOOM_QUESTIONS[index].id] === option.value}
                className={`q-option ${option.value === 0 ? "unsure" : ""} ${answers[BLOOM_QUESTIONS[index].id] === option.value ? "selected" : ""}`}
                onClick={() => choose(option.value)}
              >
                {t(option.label)}
              </button>
            ))}
          </div>
        </>
      ) : pendingTie ? (
        <>
          <span className="eyebrow">{b("q.tieTitle")}</span>
          <p className="q-text">{self ? b("q.tieSelf") : b("q.tieFriend", { name })}</p>
          <div className="q-options">
            {AXIS_POLES[pendingTie].map((letter) => (
              <button
                key={letter}
                className="q-option"
                onClick={() => {
                  const next = { ...tiebreaks, [pendingTie]: letter };
                  setTiebreaks(next);
                  settle(answers, next);
                }}
              >
                {b(`tie.${letter}` as BloomKey)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>
      )}
    </section>
  );
}

export function TypePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const b = useBloomCopy();
  return (
    <div className="type-picker" role="group" aria-label={b("setup.letters")}>
      {(Object.keys(AXIS_POLES) as Dimension[]).map((dimension, index) => (
        <div key={dimension} className="type-row">
          {AXIS_POLES[dimension].map((letter) => (
            <button
              key={letter}
              type="button"
              aria-pressed={value[index] === letter}
              onClick={() => {
                const letters = (value.padEnd(4, " ")).split("");
                letters[index] = letter;
                onChange(letters.join(""));
              }}
            >
              <strong>{letter}</strong>
              <small>{b(`tie.${letter}` as BloomKey)}</small>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export function BoardView({
  board,
  ownerName,
  selfType,
  mine,
}: {
  board: Board;
  ownerName: string;
  selfType: string | null;
  mine?: string | null;
}) {
  const b = useBloomCopy();
  if (!board.total) return <p className="muted">{b("board.empty")}</p>;
  const max = board.types[0]?.count ?? 1;
  const topTypes = board.types.filter((entry) => entry.count === max).map((entry) => entry.type);
  const showMajorityNote = board.majorityType !== null && !topTypes.includes(board.majorityType);
  return (
    <div className="board">
      <p className="board-total">{b("board.answers", { count: board.total })}</p>
      <ol className="board-list">
        {board.types.map((entry, index) => (
          <li key={entry.type} className={entry.type === selfType ? "is-self" : ""}>
            <span className="board-rank">{index === 0 || entry.count !== board.types[index - 1].count ? index + 1 : "="}</span>
            <strong className="board-type">{entry.type}</strong>
            <span className="board-bar"><i style={{ width: `${(entry.count / max) * 100}%` }} /></span>
            <span className="board-count">{entry.count}</span>
            <span className="board-tags">
              {entry.type === selfType && <em>{b("board.selfMark", { name: ownerName })}</em>}
              {entry.type === mine && <em className="mine">{b("board.yourMark")}</em>}
            </span>
          </li>
        ))}
      </ol>
      <h3 className="board-subtitle">{b("board.letters")}</h3>
      <ul className="letter-splits">
        {board.letters.map((split, index) => {
          const selfLetter = selfType?.[index];
          const note = split.majority === null
            ? b("board.even")
            : selfLetter === undefined
              ? ""
              : split.majority === selfLetter
                ? b("board.matches", { name: ownerName })
                : b("board.selfSays", { name: ownerName, letter: selfLetter });
          return (
            <li key={split.dimension}>
              <span className="split-label"><strong>{split.first.letter}</strong> {split.first.count}</span>
              <span className="split-bar"><i style={{ width: `${(split.first.count / board.total) * 100}%` }} /></span>
              <span className="split-label right">{split.second.count} <strong>{split.second.letter}</strong></span>
              {note && <small className={split.majority !== null && selfLetter && split.majority !== selfLetter ? "differs" : ""}>{note}</small>}
            </li>
          );
        })}
      </ul>
      {showMajorityNote && <p className="board-note">{b("board.majorityNote", { type: board.majorityType! })}</p>}
    </div>
  );
}

export function BadgeList({ badges }: { badges: readonly Badge[] }) {
  const b = useBloomCopy();
  return (
    <ul className="badge-list">
      {badges.map((badge) => (
        <li key={badge}>
          <strong>{b(`badge.${badge}`)}</strong>
          <span>{b(`badgeBody.${badge}`)}</span>
        </li>
      ))}
    </ul>
  );
}

const flowerPaintings: Record<Flower, StaticImageData> = {
  "globe-amaranth": globeAmaranth,
  "blue-iris": blueIris,
  iris,
  hydrangea,
};

/** A respondent's flower, earned at either end of the similarity range, with its language of flowers. */
export function FlowerAchievement({ flower, similarity, ownerName }: { flower: Flower; similarity: number; ownerName: string }) {
  const b = useBloomCopy();
  const name = b(`flower.name.${flower}`);
  return (
    <section className={`bloom-card flower-card ${flower}`}>
      <Image className="flower-painting" src={flowerPaintings[flower]} alt={b("flower.alt", { name })} sizes="(max-width: 640px) 50vw, 200px" />
      <div className="flower-copy">
        <span className="card-kicker">{b("flower.kicker")}</span>
        <h2 className="card-title">{name}</h2>
        <em className="flower-meaning">{b(`flower.meaning.${flower}`)}</em>
        <p>{b(`flower.body.${flower}`, { name: ownerName })}</p>
        <small className="flower-score">{b("flower.score", { score: similarity, name: ownerName })}</small>
      </div>
    </section>
  );
}
