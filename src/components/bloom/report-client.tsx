"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui";
import { BLOOM_QUESTIONS, THRESHOLDS, type BloomReport } from "@/lib/bloom";
import { useBloomCopy } from "@/lib/bloom-i18n";
import { answerLabel, buildAiPrompt, notableGaps } from "@/lib/bloom-prompt";
import { I18nProvider, translateQuestion, useI18n, type TranslationKey } from "@/lib/i18n";
import { ApiError, BadgeList, BloomHeader, FlowerGuide, BoardView, api, useErrorText } from "./shared";

const axisTitles: Record<string, TranslationKey> = {
  EI: "results.social",
  SN: "results.information",
  TF: "results.decisions",
  JP: "results.structure",
};

export default function ReportClient() {
  return (
    <I18nProvider>
      <ReportContent />
    </I18nProvider>
  );
}

function ReportContent() {
  const { locale, t } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [data, setData] = useState<{ displayName: string; report: BloomReport } | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api<{ displayName: string; report: BloomReport }>("/api/bloom/report")
      .then(setData)
      .catch((caught) => {
        if (caught instanceof ApiError && (caught.status === 401 || caught.status === 404)) setSignedOut(true);
        else setError(errorText(caught));
      });
  }, [errorText]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  let body;
  if (signedOut) {
    body = (
      <section className="bloom-card">
        <p>{b("r.only")}</p>
        <Link className="button primary" href="/bloom">{b("signin.titlePlain")} <ArrowIcon /></Link>
      </section>
    );
  } else if (!data) {
    body = error ? <p className="form-error centered">{error}</p> : <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>;
  } else {
    const { report, displayName } = data;
    const prompt = buildAiPrompt(report, locale);
    const gaps = notableGaps(report);
    body = (
      <>
        <section className="bloom-hero">
          <Link className="back-link" href="/bloom"><ArrowIcon direction="left" /> {b("r.back")}</Link>
          <span className="eyebrow">{b("r.eyebrow")}</span>
          <h1>{b("r.title")}</h1>
          <p>{b("r.summary", { type: report.selfType, count: report.total })} {b("r.only")}</p>
        </section>

        {report.total === 0 ? (
          <section className="bloom-card"><p className="muted">{b("r.empty")}</p></section>
        ) : (
          <>
            {report.badges.length > 0 && (
              <section className="bloom-card">
                <h2 className="card-title">{b("r.badges")}</h2>
                <BadgeList badges={report.badges} />
              </section>
            )}

            <section className="bloom-card">
              <h2 className="card-title">{b("r.lettersTitle")}</h2>
              <ul className="reading-list">
                {report.axes.map((axis) => {
                  const split = report.board.letters.find((entry) => entry.dimension === axis.dimension)!;
                  const text = axis.pattern === "agree"
                    ? b("r.agree", { count: axis.majorityCount, total: report.total, letter: axis.majority! })
                    : axis.pattern === "outside"
                      ? b("r.outside", { self: axis.selfLetter, count: axis.majorityCount, total: report.total, letter: axis.majority! })
                      : b("r.split", { a: split.first.letter, aCount: split.first.count, b: split.second.letter, bCount: split.second.count, self: axis.selfLetter });
                  return (
                    <li key={axis.dimension} className={`reading ${axis.pattern}`}>
                      <span className="reading-axis">{axis.dimension}</span>
                      <div><strong>{t(axisTitles[axis.dimension])}</strong><p>{text}</p></div>
                    </li>
                  );
                })}
              </ul>
              <BoardView board={report.board} ownerName={displayName} selfType={report.selfType} />
            </section>

            <section className="bloom-card">
              <h2 className="card-title">{b("r.behavioursTitle")}</h2>
              {report.behaviours.status === "locked" ? (
                <p className="muted">{b("r.locked", { threshold: THRESHOLDS.behaviours, needed: report.behaviours.needed })}</p>
              ) : report.behaviours.status === "needs-self" ? (
                <>
                  <p className="muted">{b("r.needSelf")}</p>
                  <Link className="button secondary" href="/bloom">{b("dash.selfStart")} <ArrowIcon /></Link>
                </>
              ) : gaps.length === 0 ? (
                <p className="muted">{b("r.noGaps")}</p>
              ) : (
                <ul className="gap-list">
                  {gaps.map((item) => {
                    const question = BLOOM_QUESTIONS.find((candidate) => candidate.id === item.questionId)!;
                    return (
                      <li key={item.questionId}>
                        <p>{translateQuestion(question.id, question.text, "", true, locale)}</p>
                        <small>{b("r.behaviourLine", { self: answerLabel(locale, item.selfValue), agree: item.agree, neutral: item.neutral, disagree: item.disagree })}</small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {report.flowers ? (
              <FlowerGuide counts={report.flowers} />
            ) : (
              <section className="bloom-card">
                <h2 className="card-title">{b("flowers.title")}</h2>
                <p className="muted">{b("flowers.locked", { threshold: THRESHOLDS.flowers, needed: THRESHOLDS.flowers - report.total })}</p>
              </section>
            )}

            <section className="bloom-card">
              <h2 className="card-title">{b("r.audiencesTitle")}</h2>
              {report.audiences.status === "locked" ? (
                <p className="muted">{b("r.locked", { threshold: THRESHOLDS.audiences, needed: report.audiences.needed })}</p>
              ) : report.audiences.groups.length === 0 ? (
                <p className="muted">{b("r.noAudiences")}</p>
              ) : (
                <ul className="reading-list">
                  {report.audiences.groups.map((group) => {
                    const top = group.types[0];
                    const clear = top && (group.types.length === 1 || top.count > group.types[1].count);
                    return (
                      <li key={group.relation} className="reading">
                        <span className="reading-axis">{group.count}</span>
                        <p>
                          {clear
                            ? b("r.audienceLine", { relation: b(`relp.${group.relation}`), count: group.count, type: top.type })
                            : b("r.audienceMixed", { relation: b(`relp.${group.relation}`), count: group.count, types: group.types.map((entry) => `${entry.type} ${entry.count}`).join(", ") })}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        <section className="bloom-card">
          <h2 className="card-title">{b("r.aiTitle")}</h2>
          <p>{b("r.aiBody")}</p>
          <button
            className="button primary"
            onClick={async () => {
              await navigator.clipboard.writeText(prompt);
              setNotice(b("r.aiCopied"));
            }}
          >
            {b("r.aiCopy")}
          </button>
          <details className="prompt-preview">
            <summary>{b("r.aiPreview")}</summary>
            <pre>{prompt}</pre>
          </details>
        </section>
        <p className="disclaimer">{t("results.disclaimer")}</p>
      </>
    );
  }

  return (
    <main className="app-shell bloom-shell">
      <BloomHeader />
      <div className="bloom-page">{body}</div>
      {notice && <div className="toast"><CheckIcon />{notice}</div>}
    </main>
  );
}
