import { ImageResponse } from "next/og";
import { currentUser } from "@/lib/accounts";
import { THRESHOLDS } from "@/lib/bloom";
import { getSurveyByOwner, surveyReport } from "@/lib/bloom-data";
import { bloomText } from "@/lib/bloom-i18n";
import { error } from "@/lib/http";
import { asterMark, fontStacks, palette, shareFonts } from "@/lib/share-image";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

const size = { width: 1080, height: 1920 };

function locale(value: string | null): Locale {
  return value === "zh-Hant" || value === "ja" || value === "ko" ? value : "en";
}

/**
 * The initiator's story-sized result card: their own type, the most-chosen
 * type, the letter splits and their gap badges. It carries no respondent names.
 */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return error("Sign in first.", 401);
  const survey = await getSurveyByOwner(user.id);
  if (!survey) return error("Create your survey first.", 404);
  const report = await surveyReport(survey);
  if (report.total < THRESHOLDS.board) return error(`The card opens at ${THRESHOLDS.board} answers.`, 409);

  const url = new URL(request.url);
  const lang = locale(url.searchParams.get("locale"));
  const text = (key: Parameters<typeof bloomText>[1], variables?: Record<string, string | number>) => bloomText(lang, key, variables);
  const top = report.board.types[0].count;
  const topTypes = report.board.types.filter((entry) => entry.count === top).map((entry) => entry.type).slice(0, 2);
  const badges = report.badges.slice(0, 3).map((badge) => text(`badge.${badge}`));
  const said = text("card.said");
  const friendsSaid = text("card.friendsSaid", { count: report.total });
  const ask = text("card.ask");
  const link = `${url.host}/s/${survey.code}`;
  const letters = report.board.letters;

  const { serifStack, sansStack } = fontStacks(`${report.selfType}${topTypes.join("")}${ask}` + `Aster${said}${friendsSaid}${badges.join("")}${link}EISNTFJP0123456789·`);
  const [mark, fonts] = await Promise.all([
    asterMark(),
    shareFonts(`${report.selfType}${topTypes.join("")}${ask}`, `Aster${said}${friendsSaid}${badges.join("")}${link}EISNTFJP0123456789·`),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: palette.paper, padding: "96px 88px", fontFamily: sansStack, wordBreak: "keep-all", color: palette.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40 }}>
          <img src={mark} width={68} height={68} alt="" />
          Aster
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 110 }}>
          <div style={{ fontSize: 44, color: palette.fern }}>{said}</div>
          <div style={{ fontFamily: serifStack, fontSize: 200, lineHeight: 1, letterSpacing: 4 }}>{report.selfType}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 70 }}>
          <div style={{ fontSize: 44, color: palette.fern }}>{friendsSaid}</div>
          <div style={{ fontFamily: serifStack, fontSize: topTypes.length > 1 ? 150 : 200, lineHeight: 1, letterSpacing: 4, color: palette.lilacDeep }}>
            {topTypes.join(" · ")}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 90 }}>
          {letters.map((split) => (
            <div key={split.dimension} style={{ display: "flex", alignItems: "center", gap: 24, fontSize: 38 }}>
              <div style={{ display: "flex", width: 110 }}>{`${split.first.letter} ${split.first.count}`}</div>
              <div style={{ display: "flex", flex: 1, height: 22, borderRadius: 11, background: palette.clay, overflow: "hidden" }}>
                <div style={{ width: `${(split.first.count / report.total) * 100}%`, height: "100%", background: palette.ink }} />
              </div>
              <div style={{ display: "flex", width: 110, justifyContent: "flex-end" }}>{`${split.second.count} ${split.second.letter}`}</div>
            </div>
          ))}
        </div>

        {badges.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 80 }}>
            {badges.map((badge) => (
              <div key={badge} style={{ display: "flex", padding: "14px 30px", borderRadius: 999, background: palette.marker, fontSize: 38 }}>{badge}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
          <div style={{ fontFamily: serifStack, fontSize: 60 }}>{ask}</div>
          <div style={{ fontSize: 36, color: palette.fern }}>{link}</div>
        </div>
      </div>
    ),
    { ...size, fonts, headers: { "Cache-Control": "private, no-store" } },
  );
}
