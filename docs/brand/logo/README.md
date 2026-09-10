# Full logo

Mark plus wordmark, set in Geist SemiBold — the same face the app uses.
All transparent PNG except the plate.

| File | Use |
|---|---|
| `logo-dark.png` | Primary. White wordmark, for dark backgrounds. 2068×696 |
| `logo-light.png` | Primary. Dark wordmark, for light backgrounds. 2068×696 |
| `logo-mono.png` | One colour. For stamping, embroidery, single-colour print. |
| `logo-stacked.png` | Mark above wordmark, for square spaces. 1390×1184 |
| `logo-plate.png` | On its own ground, 3000×1002 — an X header at 1500×500. |

## Regenerating

`render-logo.html` is the source. It loads Geist from `node_modules`, so run
`npm install` first, then screenshot each `.tile` element with
`omitBackground: true` (the plate excepted — it is meant to have a ground).

Two things that will bite:

- The page background must be `transparent`. `omitBackground` does not override
  an explicit `body { background }`, and the first render of these had the
  page's grey baked in behind every "transparent" logo.
- Wait for `document.fonts.ready` before screenshotting, or the wordmark falls
  back to a system sans and the spacing is wrong.

The font file itself is not committed — it is licensed, and it is already in
`node_modules/geist`.

## Not outlined

The wordmark is live text at render time, not paths. For anything that has to
survive without the font — a vector logo for a printer, a partner's brand
sheet — it needs outlining from the licensed face first.
