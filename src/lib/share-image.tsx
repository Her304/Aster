import { ASTER_MARK_DATA_URL } from "@/images/aster-mark-data";

/**
 * Shared pieces for the generated share images. ImageResponse only reads TTF,
 * OTF or WOFF and bundles no CJK face, so fonts are fetched from Google Fonts
 * per image, subset to exactly the characters drawn (a few kilobytes). If that
 * fails the image still renders with the built-in Latin face.
 */

export const palette = {
  paper: "#f6f1e7",
  paperDeep: "#ece4d6",
  ink: "#153d2f",
  inkSoft: "#315546",
  fern: "#537760",
  moss: "#c7d3b7",
  lilac: "#cbc1db",
  lilacDeep: "#9a87b6",
  clay: "#d9a889",
  marker: "#e9b93a",
  white: "#fffdf8",
};

type Weight = 500 | 700;
type FontEntry = { name: string; data: ArrayBuffer; weight: Weight; style: "normal" };

async function googleFont(family: string, weight: Weight, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((response) => (response.ok ? response.text() : ""));
    const source = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!source) return null;
    const response = await fetch(source);
    return response.ok ? response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

const KANA = /[\u3040-\u30ff]/;
const HANGUL = /[\u1100-\u11ff\uac00-\ud7af]/;

const SCRIPT_FONTS = {
  TC: { serif: "Noto Serif TC", sans: "Noto Sans HK" },
  JP: { serif: "Noto Serif JP", sans: "Noto Sans JP" },
  KR: { serif: "Noto Serif KR", sans: "Noto Sans KR" },
} as const;
type Script = keyof typeof SCRIPT_FONTS;

/**
 * One serif and one sans per image, matching the language on it (DESIGN.md:
 * no more than three faces). Every set covers Latin and Han, so Japanese text
 * gets Japanese kanji forms and Korean text Korean ones. A second set loads
 * only when the text holds a script the first cannot draw, such as a Korean
 * name on a Chinese survey.
 */
function scriptsFor(text: string): Script[] {
  const primary: Script = KANA.test(text) ? "JP" : HANGUL.test(text) ? "KR" : "TC";
  const extra: Script[] = [];
  if (HANGUL.test(text) && primary !== "KR") extra.push("KR");
  if (KANA.test(text) && primary !== "JP") extra.push("JP");
  return [primary, ...extra];
}

/** Font stacks for styles, in fallback order, for the faces shareFonts loaded for this text. */
export function fontStacks(text: string) {
  const scripts = scriptsFor(text);
  return {
    serifStack: scripts.map((script) => `Serif${script}`).join(", "),
    sansStack: scripts.map((script) => `Sans${script}`).join(", "),
  };
}

/** Serif for headlines and sans for the rest. Each face gets its own name: faces sharing a name and weight would replace one another. */
export async function shareFonts(serifText: string, sansText: string): Promise<FontEntry[]> {
  const loads = scriptsFor(serifText + sansText).flatMap((script) => [
    googleFont(SCRIPT_FONTS[script].serif, 700, serifText).then((data) => (data ? { name: `Serif${script}`, data, weight: 700 as const, style: "normal" as const } : null)),
    googleFont(SCRIPT_FONTS[script].sans, 500, sansText).then((data) => (data ? { name: `Sans${script}`, data, weight: 500 as const, style: "normal" as const } : null)),
  ]);
  return (await Promise.all(loads)).filter((font): font is FontEntry => font !== null);
}

export async function asterMark() {
  return ASTER_MARK_DATA_URL;
}
