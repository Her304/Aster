"use client";

import { ArrowIcon } from "@/components/ui";
import { useBloomCopy } from "@/lib/bloom-i18n";

/** Home page invitation to the open-link survey; the first step lives on /start. */
export function OthersInvite() {
  const b = useBloomCopy();
  return (
    <section className="others-invite">
      <div className="others-invite-copy">
        <span className="eyebrow">{b("invite.eyebrow")}</span>
        <h2>{b("invite.title")}</h2>
        <p>{b("invite.body")}</p>
        <ol className="others-invite-steps">
          <li><span>1</span>{b("invite.step1")}</li>
          <li><span>2</span>{b("invite.step2")}</li>
          <li><span>3</span>{b("invite.step3")}</li>
        </ol>
      </div>
      <a className="button primary" href="/start">{b("invite.cta")} <ArrowIcon /></a>
    </section>
  );
}
