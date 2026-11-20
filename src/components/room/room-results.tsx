"use client";

import { BadgeList, BoardView, FlowerGuide } from "@/components/bloom/shared";
import {
  FLOWERS,
  buildBoard,
  flowerFor,
  gapBadges,
  matchingLetters,
  readAxes,
  scoreSimilarity,
  type Flower,
} from "@/lib/bloom";
import { useBloomCopy } from "@/lib/bloom-i18n";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { DIMENSIONS, type Dimension } from "@/lib/scoring";
import { avatarColors, initials, type CompactProfile, type ResultsData } from "./common";

const axisTitles: Record<Dimension, TranslationKey> = {
  EI: "results.social",
  SN: "results.information",
  TF: "results.decisions",
  JP: "results.structure",
};

function scoresOf(profile: CompactProfile) {
  return Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, profile.dimensions[dimension]?.score]));
}

/** A room's reveal, laid out like the open-link survey's report: the same readings, board and flowers. */
export function RoomResults({ results }: { results: ResultsData }) {
  const { t } = useI18n();
  const b = useBloomCopy();
  const me = results.people.find((person) => person.isMe)!;
  const selfType = me.self?.type ?? null;
  const board = buildBoard(me.perspectives.flatMap((perspective) => (perspective.profile.type ? [perspective.profile.type] : [])));
  const axes = selfType && board.total ? readAxes(selfType, board) : null;
  const badges = axes ? gapBadges(axes, board.total) : [];
  const views = me.perspectives.map((perspective) => ({
    ...perspective,
    flower: selfType ? flowerFor(scoreSimilarity(selfType, scoresOf(perspective.profile))) : null,
  }));
  const flowerCounts = Object.fromEntries(FLOWERS.map((flower) => [flower, views.filter((view) => view.flower === flower).length])) as Record<Flower, number>;
  const matched = selfType && me.overall.type ? matchingLetters(selfType, me.overall.type) : null;

  const dimensionLabels: Record<Dimension, { left: string; right: string }> = {
    EI: { left: t("results.extraverted"), right: t("results.introverted") },
    SN: { left: t("results.observant"), right: t("results.imaginative") },
    TF: { left: t("results.analytical"), right: t("results.valuesLed") },
    JP: { left: t("results.planned"), right: t("results.flexible") },
  };

  return (
    <>
      <section className="bloom-hero">
        <span className="eyebrow">{t("results.reflection", { name: me.nickname })}</span>
        <h1>{me.overall.type ? t("results.headline", { type: me.overall.type }) : t("results.insufficientHeadline")}</h1>
        <p>
          {!selfType
            ? t("results.noSelf")
            : matched === 4
              ? t("results.selfExact", { type: selfType })
              : matched !== null
                ? t("results.selfLine", { type: selfType, count: matched })
                : t("results.insufficientBody")}
        </p>
        {me.overall.type && me.overall.closelyBalancedDimensions.length > 0 && (
          <p>{t("results.balanced", { dimensions: me.overall.closelyBalancedDimensions.join(" / ") })}</p>
        )}
      </section>

      {badges.length > 0 && (
        <section className="bloom-card">
          <h2 className="card-title">{b("r.badges")}</h2>
          <BadgeList badges={badges} />
        </section>
      )}

      <section className="bloom-card">
        <h2 className="card-title">{t("results.boardTitle")}</h2>
        {axes && (
          <ul className="reading-list">
            {axes.map((axis) => {
              const split = board.letters.find((entry) => entry.dimension === axis.dimension)!;
              const text = axis.pattern === "agree"
                ? b("r.agree", { count: axis.majorityCount, total: board.total, letter: axis.majority! })
                : axis.pattern === "outside"
                  ? b("r.outside", { self: axis.selfLetter, count: axis.majorityCount, total: board.total, letter: axis.majority! })
                  : b("r.split", { a: split.first.letter, aCount: split.first.count, b: split.second.letter, bCount: split.second.count, self: axis.selfLetter });
              return (
                <li key={axis.dimension} className={`reading ${axis.pattern}`}>
                  <span className="reading-axis">{axis.dimension}</span>
                  <div><strong>{t(axisTitles[axis.dimension])}</strong><p>{text}</p></div>
                </li>
              );
            })}
          </ul>
        )}
        <BoardView board={board} ownerName={me.nickname} selfType={selfType} />
      </section>

      <section className="bloom-card">
        <h2 className="card-title">{t("results.compare")}</h2>
        <div className="bar-key"><span className="friends-key">{t("common.friends")}</span>{me.self && <span className="self-key">{t("common.self")}</span>}</div>
        <div className="dimension-list">
          {DIMENSIONS.map((dimension) => {
            const labels = dimensionLabels[dimension];
            const friend = me.overall.dimensions[dimension];
            const self = me.self?.dimensions[dimension];
            return (
              <div className="dimension-row" key={dimension}>
                <div className="dimension-title"><span>{dimension}</span><div><strong>{t(axisTitles[dimension])}</strong>{friend?.closelyBalanced && <small>{t("results.balancedShort")}</small>}</div></div>
                <div className="dimension-plot">
                  <div className="dimension-labels"><span>{labels.left}</span><span>{labels.right}</span></div>
                  <div className="dimension-track">
                    <i className="midline" />
                    {friend && <span className="friend-marker" style={{ left: `${friend.score}%` }} title={`${t("common.friends")}: ${friend.score}`} />}
                    {self && <span className="self-marker" style={{ left: `${self.score}%` }} title={`${t("common.self")}: ${self.score}`} />}
                  </div>
                  <div className="dimension-values">
                    <span>{t("common.friends")} <strong>{friend ? Math.round(friend.score) : "—"}</strong></span>
                    {me.self && <span>{t("common.self")} <strong>{self ? Math.round(self.score) : "—"}</strong></span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bloom-card">
        <h2 className="card-title">{t("results.every")}</h2>
        <ul className="response-list">
          {views.map((view) => (
            <li key={view.reviewerName}>
              <div>
                <strong>{view.reviewerName}</strong>
                {view.flower && <span className={`flower-tag ${view.flower}`} title={b(`flower.meaning.${view.flower}`)}>{b(`flower.name.${view.flower}`)}</span>}
                <small>{t("results.seesAs")}</small>
              </div>
              <b>{view.profile.type || "—"}</b>
            </li>
          ))}
        </ul>
      </section>

      {selfType && views.length > 0 && <FlowerGuide counts={flowerCounts} />}

      <section className="bloom-card">
        <h2 className="card-title">{t("results.circleBloom")}</h2>
        <p>{t("results.summaryPrivacy")}</p>
        <ul className="response-list room-list">
          {results.people.map((person, index) => (
            <li key={person.id}>
              <div>
                <strong>{person.nickname}{person.isMe && ` · ${t("common.you")}`}</strong>
                <small>{t("results.perspectiveCount", { count: person.overall.contributingReviewerCount })}</small>
              </div>
              <span className={`avatar avatar-small ${avatarColors[index % avatarColors.length]}`}>{initials(person.nickname)}</span>
              <b>{person.overall.type || "—"}</b>
            </li>
          ))}
        </ul>
      </section>

      <p className="disclaimer">{t("results.disclaimer")}</p>
    </>
  );
}
