import { ImageResponse } from "next/og";
import { getSurveyByCode } from "@/lib/bloom-data";
import { asterMark, palette, sansStack, serifStack, shareFonts } from "@/lib/share-image";

export const alt = "An invitation to answer a short Aster survey";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The link preview a survey shows when it's pasted into a chat. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const survey = await getSurveyByCode(code).catch(() => undefined);
  const subject = survey ? `${survey.display_name}?` : "me?";
  const headline = `How do you see ${subject}`;
  const detail = "Sixteen quick questions · about two minutes";
  const footer = "Answer, then see how everyone else sees them.";
  const [mark, fonts] = await Promise.all([asterMark(), shareFonts(headline, `${detail}${footer}Aster`)]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: palette.paper, padding: 72, fontFamily: sansStack, wordBreak: "keep-all" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: palette.ink, fontSize: 34 }}>
            <img src={mark} width={56} height={56} alt="" />
            Aster
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexWrap: "wrap", fontFamily: serifStack, fontSize: 84, lineHeight: 1.05, color: palette.ink, letterSpacing: -2, maxWidth: 860 }}>
              <span>How do you see&nbsp;</span>
              {/* The name and its question mark stay on one line. */}
              <span style={{ whiteSpace: "nowrap" }}>{subject}</span>
            </div>
            <div style={{ fontSize: 34, color: palette.fern }}>{detail}</div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: palette.inkSoft }}>{footer}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 240 }}>
          <div style={{ width: 220, height: 220, borderRadius: 110, background: palette.lilac, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src={mark} width={170} height={170} alt="" />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
