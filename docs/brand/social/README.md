# Social images

## X profile picture

Upload **`x-aurora.png`** or **`x-jade.png`** at 1000×1000. X crops to a circle
and downsamples.

Compare all five in `preview-x-premium.html`, at the sizes X actually renders
them (132, 48, 32, 24) across its three themes.

| Option | |
|---|---|
| **Aurora** | Mint bloom behind the mark, carrying past it. The strongest edge on a black timeline without using a border. |
| **Jade** | Both chevrons in one mint range instead of white-plus-green. The most cohesive, and the most clearly ours. |
| Lumen | Lit from the top left with a rim on the plate. Closest to the app's own surfaces. |
| Emboss | The mark reads as cut into the plate rather than sitting on it. |
| Steel | No colour at all. Very restrained — but it gives up the accent. |

### What went wrong first

The earlier black set (`x-avatar-black*.png`) passed every legibility test and
still looked cheap. Flat fill on flat black has no surface: no light direction,
no depth, sharp corners. Testing for contrast will never catch that, because
contrast was never the problem.

What fixed it: a plate that is a gradient rather than a colour, one light source
top-left in every option, rounded corners on the chevrons, and depth beneath the
mark.

### Still true, and worth keeping

- The ground is `#08090A`, never `#000000`. X's dark theme is pure black, so a
  pure-black avatar loses its circle entirely.
- The chevron gap is wider than the app mark's. At 24px the original gap was
  under a pixel and the two shapes closed into one blob.

The earlier sets are kept for reference: `preview-x.html` (first pass) and
`preview-x-black.html` (flat black).

## Regenerating

`render-premium.html`, `render-black.html` and `render.html` hold the source of
every tile. Edit one, then screenshot each `.tile` element at 1000×1000.

## X header

1500×500. Four options, compared in `preview-header.html` against a mock of the
real profile — header, avatar overlapping it, name and bio — under both
candidate avatars.

| File | |
|---|---|
| **`x-header-line.png`** | The positioning sentence. Uses the space to say something the profile does not already say. |
| `x-header-mark.png` | The mark alone, right of the avatar. |
| `x-header-quiet.png` | Atmosphere only. Nothing to collide with, nothing to go stale. |
| `x-header-lockup.png` | Mark and wordmark — but the account name sits directly beneath it, so this repeats itself. |

Two constraints shaped all of them:

- **The avatar covers the bottom-left.** At 1500×500 it eats roughly the first
  370px horizontally and the lower third. Content starts at x=430.
- **Mobile crops the top and bottom bands.** Everything is inset 96px from
  every edge, and the bloom sits right of centre so the light is not in the
  part the avatar hides.

## Open Graph card

Two cards, both 1200×630 at 2×, both wired up in `src/lib/og.ts`:

| File | Shown when someone pastes |
|---|---|
| **`public/og/site.jpg`** | `requit.xyz` and every page without a card of its own — the landing page, `/proof`, the policies. Attached in the root layout. |
| **`public/og/play.jpg`** | `requit.xyz/play` or any game page. |

Before these the site had no link preview at all, on any page: a forwarded link
was a bare row of text, which is what a link to an abandoned project looks like.

Source is `render-og.html`. Regenerate with `npx tsx scripts/og.ts` (needs a
local `playwright` — it is deliberately not a dependency, see `tsconfig.json`).

Three things it does on purpose:

- **One mark per game.** They are the same miniatures the shelf draws, so the
  card is about *our* games rather than about games. Add a game and the shelf
  grows by itself; this file does not, so redraw it — it is at seven.
- **JPEG, not PNG.** The grain that keeps a flat panel on flat black from
  looking cheap is noise, and noise is what PNG cannot compress. The first
  render was 2.6MB, which WhatsApp declines to fetch. The same card as JPEG is
  160KB.
- **The headline is spelled, not numbered.** "Seven games", matching `spell()`
  in `src/lib/format.ts`, which the page's own `og:title` uses — a preview whose
  title says 7 and whose picture says seven looks assembled by two people.

Two things on the site card in particular:

- **It says tasks are not live yet**, in amber, as the site itself does. A
  preview that implies live paid work while the page says otherwise is the
  impression this product exists to avoid — and the badge is the first thing to
  change on the day Phase 1 opens.
- **The three steps are the product**, not decoration: finish, confirmed, paid.
  A stranger who never scrolls past the preview has still been told what this
  is and what it pays in.

## Not made yet

App icons beyond `src/app/icon.svg`: no `apple-touch-icon`, no web manifest. A
phone that bookmarks the site draws its own initial today.
