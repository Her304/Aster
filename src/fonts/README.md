# Handwriting subsets

The `--hand` custom property gives the landing page its handwritten voice.
Latin is covered by Caveat, pulled at build time by `next/font/google`. Korean
and Traditional Chinese need faces of their own, and neither is reliably
installed on a reader's device.

The full faces are far too heavy to ship — roughly 1.2 MB for Nanum Pen Script
and 3.3 MB for LXGW WenKai TC. Next's Google Fonts catalogue also exposes no
`korean` or `chinese-traditional` subset for either family, so
`next/font/google` cannot fetch their CJK glyphs at all.

`--hand` is only ever applied to static landing-page copy — never to nicknames
or anything else a person types — so the files here are subset to exactly the
glyphs that copy uses. They are loaded through `next/font/local` with
`preload: false`, so a reader downloads only the face for the language they are
actually reading.

| File | Family | Glyphs | Size |
| --- | --- | --- | --- |
| `nanum-pen-ko-subset.woff2` | Nanum Pen Script | 293 | 61 KB |
| `lxgw-wenkai-zh-hant-subset.woff2` | LXGW WenKai TC | 400 | 122 KB |

## Licences

Both are used under the SIL Open Font License 1.1.

- **Nanum Pen Script** — Copyright © 2010 NHN Corporation. Font designed by
  Sandoll Communications Inc. Licence: <http://scripts.sil.org/OFL>
- **LXGW WenKai TC** — Copyright 2024 The LXGW WenKai Project Authors
  (<https://github.com/lxgw/LxgwWenkaiTC>). Licence:
  <https://openfontlicense.org>

## Regenerating

The subsets cover the Traditional Chinese and Korean UI strings in
`src/lib/i18n.tsx` as they stood when generated. Any character outside them
falls back to the next family in the `--hand` stack, so new copy degrades
rather than breaking — but it is worth regenerating when the copy changes.

Collect the characters from the `zhHant` and `ko` translation tables, then ask
the Google Fonts API for a subset containing exactly those:

```
https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&text=<urlencoded>
https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC&text=<urlencoded>
```

Request with a modern browser `User-Agent` so the API returns woff2, then save
the file the CSS points at over the one here.
