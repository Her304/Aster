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

const SCRIPT_FONTS = [
  { suffix: "", serif: "Noto Serif TC", sans: "Noto Sans HK", needed: () => true },
  { suffix: "JP", serif: "Noto Serif JP", sans: "Noto Sans JP", needed: (text: string) => /[\u3040-\u30ff]/.test(text) },
  { suffix: "KR", serif: "Noto Serif KR", sans: "Noto Sans KR", needed: (text: string) => /[\u1100-\u11ff\uac00-\ud7af]/.test(text) },
];

/** Font stacks to use in styles: every loaded face of a kind, in fallback order. */
export const serifStack = SCRIPT_FONTS.map((font) => `Serif${font.suffix}`).join(", ");
export const sansStack = SCRIPT_FONTS.map((font) => `Sans${font.suffix}`).join(", ");

/**
 * Serif for headlines and sans for the rest, with Japanese and Korean faces
 * added when the text needs them. Each face gets its own name: faces sharing
 * a name and weight would replace one another.
 */
export async function shareFonts(serifText: string, sansText: string): Promise<FontEntry[]> {
  const all = serifText + sansText;
  const loads = SCRIPT_FONTS.filter((font) => font.needed(all)).flatMap((font) => [
    googleFont(font.serif, 700, serifText).then((data) => (data ? { name: `Serif${font.suffix}`, data, weight: 700 as const, style: "normal" as const } : null)),
    googleFont(font.sans, 500, sansText).then((data) => (data ? { name: `Sans${font.suffix}`, data, weight: 500 as const, style: "normal" as const } : null)),
  ]);
  return (await Promise.all(loads)).filter((font): font is FontEntry => font !== null);
}

export async function asterMark() {
  return ASTER_MARK_DATA_URL;
}
