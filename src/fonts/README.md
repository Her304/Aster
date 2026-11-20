# Handwriting subsets

The `--hand` custom property gives the landing page its handwritten voice.
Latin is covered by Caveat, pulled at build time by `next/font/google`. Korean
and Traditional Chinese need faces of their own, which are rarely installed on a
reader's device.

The full Nanum Pen Script face is roughly 1.2 MB, too heavy to ship whole.

Traditional Chinese handwriting uses **Aster Hand TC**, a subset of
ChenYuluoyan 2.0 Thin (辰宇落雁體). Latin in handwritten copy stays in Caveat,
like on every other page, so the subset holds only Chinese characters and
punctuation. Headings use Noto Serif TC and other text Noto Sans HK, both from
`next/font/google` in `src/app/layout.tsx`.

ChenYuluoyan has no kana and no Hangul, so it is not used for Japanese or
Korean.

`--hand` is only ever applied to static landing-page copy — never to nicknames
or anything else a person types — so the files here are subset to exactly the
glyphs that copy uses. They are loaded through `next/font/local` with
`preload: false`, so a reader downloads only the face for the language they are
actually reading.

| File | Family | Glyphs | Size |
| --- | --- | --- | --- |
| `nanum-pen-ko-subset.woff2` | Nanum Pen Script | 293 | 61 KB |
| `aster-hand-tc-subset.woff2` | Aster Hand TC (from ChenYuluoyan 2.0 Thin) | 100 | 45 KB |

## Licences

Used under the SIL Open Font License 1.1.

- **Nanum Pen Script** — Copyright © 2010 NHN Corporation. Font designed by
  Sandoll Communications Inc. Licence: <http://scripts.sil.org/OFL>
- **Aster Hand TC** — a Modified Version of ChenYuluoyan 2.0 Thin, Copyright ©
  2022 Wang, Li-Yu and Liu, Wei-Chen
  (<https://github.com/Chenyu-otf/chenyuluoyan_thin>). "辰宇落雁" and
  "Chenyuluoyan" are Reserved Font Names, so the subset is renamed inside the
  file and must keep a different name. Licence and copyright notice:
  `OFL-aster-hand-tc.txt`.

## Regenerating

The subset covers the Korean UI strings in
`src/lib/i18n.tsx` as they stood when generated. Any character outside them
falls back to the next family in the `--hand` stack, so new copy degrades
rather than breaking — but it is worth regenerating when the copy changes.

Collect the characters from the `ko` translation table, then ask the Google
Fonts API for a subset containing exactly those:

```
https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&text=<urlencoded>
```

Request with a modern browser `User-Agent` so the API returns woff2, then save
the file the CSS points at over the one here.

### Aster Hand TC

Handwriting on Chinese pages appears only in the home page's handwritten
elements (the `--hand` selectors in `globals.css`). The subset holds the
non-ASCII characters of these Traditional Chinese strings plus
，。、！？：；「」（）—…·

- `src/lib/i18n.tsx` (`zhHant`): `home.circleCaption`, `home.snapCaption`,
  `home.eyebrow`, `home.footerNote`, `home.friendsWaiting`, `home.howEyebrow`,
  `home.navNote`, `home.newCircle`, `home.createTab`, `home.joinTab`,
  `home.sampleCircle`, `home.samplePrompt`, `home.sampleReveal`,
  `home.trustAnswer`, `home.trustInvite`, `home.trustReveal`
- `src/lib/bloom-i18n.ts` (`zhHant`): `invite.eyebrow`

With [fontTools](https://github.com/fonttools/fonttools) (`pip install fonttools brotli`):

```
pyftsubset ChenYuluoyan-2.0-Thin.ttf --text-file=chars.txt --flavor=woff2 \
  --layout-features='*' --output-file=subset.woff2
```

Then rename it (name IDs 1, 3, 4, 6, 16 and 17 to "Aster Hand TC" /
"AsterHandTC-Regular") so it carries no Reserved Font Name, and save it over
`aster-hand-tc-subset.woff2`. Characters added later fall back to Noto Sans HK.
