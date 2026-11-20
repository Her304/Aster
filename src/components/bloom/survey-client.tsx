"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowIcon } from "@/components/ui";
import { RELATIONS, matchingLetters, type Board, type BloomAnswers, type Flower, type Relation, type Tiebreaks } from "@/lib/bloom";
import { useBloomCopy } from "@/lib/bloom-i18n";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { ApiError, BloomHeader, BoardView, FlowerAchievement, Questionnaire, api, useErrorText } from "./shared";

interface SurveyView {
  survey: { code: string; displayName: string; status: "open" | "closed" };
  viewer: { isOwner: boolean; signedIn: boolean };
  total: number;
  boardThreshold: number;
  boardPublic: boolean;
  response: { name: string; relation: string; type: string; submittedAt: string; similarity: number; flower: Flower } | null;
  selfType: string | null;
  board: Board | null;
}

export default function SurveyClient({ code }: { code: string }) {
  return (
    <I18nProvider>
      <SurveyContent code={code} />
    </I18nProvider>
  );
}

function SurveyContent({ code }: { code: string }) {
  const { t } = useI18n();
  const b = useBloomCopy();
  const errorText = useErrorText();
  const [view, setView] = useState<SurveyView | null>(null);
  const [missing, setMissing] = useState(false);
  const [stage, setStage] = useState<"intro" | "questions" | "sending">("intro");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState<Relation | "">("");
  const [pending, setPending] = useState<{ answers: BloomAnswers; tiebreaks: Tiebreaks } | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setView(await api<SurveyView>(`/api/s/${code}`));
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setMissing(true);
      else setError(errorText(caught));
    }
  }, [code, errorText]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(answers: BloomAnswers, tiebreaks: Tiebreaks) {
    setPending({ answers, tiebreaks });
    setStage("sending");
    setError("");
    try {
      await api(`/api/s/${code}`, { method: "POST", body: JSON.stringify({ name, relation, answers, tiebreaks }) });
      await load();
      setPending(null);
    } catch (caught) {
      setError(errorText(caught));
      if (caught instanceof ApiError && caught.status === 409) await load();
    }
  }

  const ownerName = view?.survey.displayName ?? "";

  let body;
  if (missing) {
    body = (
      <section className="bloom-hero centered">
        <h1>{b("s.notFound")}</h1>
        <p>{b("s.notFoundBody")}</p>
      </section>
    );
  } else if (!view) {
    body = error ? <p className="form-error centered">{error}</p> : <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>;
  } else if (view.viewer.isOwner) {
    body = (
      <section className="bloom-card">
        <span className="eyebrow">{b("dash.eyebrow")}</span>
        <h1 className="card-title">{b("s.ownerTitle")}</h1>
        <p>{b("s.ownerBody")}</p>
        <Link className="button primary" href="/bloom">{b("s.ownerOpen")} <ArrowIcon /></Link>
      </section>
    );
  } else if (view.response) {
    body = <ResultView view={view} />;
  } else if (view.survey.status === "closed") {
    body = (
      <section className="bloom-hero centered">
        <h1>{b("s.closed")}</h1>
        <p>{b("s.closedBody", { name: ownerName })}</p>
      </section>
    );
  } else if (stage === "questions") {
    body = <Questionnaire name={ownerName} self={false} onDone={submit} onCancel={() => setStage("intro")} />;
  } else if (stage === "sending") {
    body = (
      <section className="bloom-card centered">
        {error ? (
          <>
            <p className="form-error">{error}</p>
            {pending && <button className="button primary" onClick={() => submit(pending.answers, pending.tiebreaks)}>{b("s.retry")} <ArrowIcon /></button>}
          </>
        ) : (
          <div className="loading-dots" aria-label={t("common.loading")}><span /><span /><span /></div>
        )}
      </section>
    );
  } else {
    body = (
      <>
        <section className="bloom-hero">
          <span className="eyebrow">{b("s.eyebrow")}</span>
          <h1>{b("s.title", { name: ownerName })}</h1>
          <p>{b("s.lede", { name: ownerName })}</p>
        </section>
        <form
          className="bloom-card form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (relation) setStage("questions");
          }}
        >
          <label className="field">
            <span>{b("s.nameLabel")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={b("s.namePlaceholder", { name: ownerName })} required minLength={2} maxLength={24} autoComplete="nickname" />
          </label>
          <p className="helper-note">{b("s.nameNote", { name: ownerName })}</p>
          <fieldset className="field chips">
            <legend>{b("s.relationLabel", { name: ownerName })}</legend>
            <div className="chip-row">
              {RELATIONS.map((option) => (
                <button key={option} type="button" className="chip" aria-pressed={relation === option} onClick={() => setRelation(option)}>
                  {b(`rel.${option}`)}
                </button>
              ))}
            </div>
          </fieldset>
          <button className="button primary wide" disabled={name.trim().length < 2 || !relation}>{b("s.begin")} <ArrowIcon /></button>
        </form>
      </>
    );
  }

  return (
    <main className="app-shell bloom-shell">
      <BloomHeader />
      <div className="bloom-page">{body}</div>
    </main>
  );
}

function ResultView({ view }: { view: SurveyView }) {
  const b = useBloomCopy();
  const response = view.response!;
  const ownerName = view.survey.displayName;
  const matched = view.selfType ? matchingLetters(response.type, view.selfType) : 0;
  return (
    <>
      <section className="bloom-hero">
        <span className="eyebrow">{b("s.resultEyebrow")}</span>
        <h1>{b("s.resultTitle", { name: ownerName, type: response.type })}</h1>
        {view.selfType && (
          <p>{matched === 4 ? b("s.resultExact", { name: ownerName, type: view.selfType }) : b("s.resultSelf", { name: ownerName, type: view.selfType, count: matched })}</p>
        )}
      </section>
      <FlowerAchievement flower={response.flower} similarity={response.similarity} ownerName={ownerName} />
      <section className="bloom-card">
        <h2 className="card-title">{b("s.boardTitle", { name: ownerName })}</h2>
        {view.board ? (
          <BoardView board={view.board} ownerName={ownerName} selfType={view.selfType} mine={response.type} />
        ) : !view.boardPublic ? (
          <p className="muted">{b("s.boardHidden", { name: ownerName })}</p>
        ) : (
          <p className="muted">{b("s.boardWait", { threshold: view.boardThreshold, count: view.total })}</p>
        )}
        <p className="helper-note">{b("s.remembered")}</p>
      </section>
      <section className="bloom-card make-own">
        <div>
          <h2 className="card-title">{b("s.makeOwnTitle")}</h2>
          <p>{b("s.makeOwnBody")}</p>
        </div>
        <Link className="button primary" href={`/bloom?name=${encodeURIComponent(response.name)}`}>{b("s.makeOwn")} <ArrowIcon /></Link>
      </section>
    </>
  );
}
