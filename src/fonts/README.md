# Handwriting subsets

The `--hand` custom property gives the landing page its handwritten voice.
Latin is covered by Caveat, pulled at build time by `next/font/google`. Korean
needs a face of its own, which is rarely installed on a reader's device.

The full Nanum Pen Script face is roughly 1.2 MB, too heavy to ship whole.

Traditional Chinese does not use a handwriting face: headings use Noto Serif TC
and all other text, handwriting included, uses Noto Sans HK. Both come from
`next/font/google` in `src/app/layout.tsx`, which self-hosts Google's
unicode-range slices so a browser fetches only the characters on screen.

`--hand` is only ever applied to static landing-page copy — never to nicknames
or anything else a person types — so the files here are subset to exactly the
glyphs that copy uses. They are loaded through `next/font/local` with
`preload: false`, so a reader downloads only the face for the language they are
actually reading.

| File | Family | Glyphs | Size |
| --- | --- | --- | --- |
| `nanum-pen-ko-subset.woff2` | Nanum Pen Script | 293 | 61 KB |

## Licences

Used under the SIL Open Font License 1.1.

- **Nanum Pen Script** — Copyright © 2010 NHN Corporation. Font designed by
  Sandoll Communications Inc. Licence: <http://scripts.sil.org/OFL>

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
