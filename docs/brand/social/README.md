# Social images

## X profile picture

Upload **`x-avatar-black-big.png`** at 1000×1000. X crops to a circle and
downsamples.

Two alternatives if you want a different feel:

- **`x-avatar-black-mono.png`** — no accent at all, white chevrons only.
  The most restrained of the set and the highest contrast at 24px.
- **`x-avatar-black-hair.png`** — same black ground with a white outline, if
  you want the circle to have a hard boundary.

Open `preview-x-black.html` to compare them at the sizes X actually renders —
112, 48, 32 and 24 — across its three themes.

### What the black test showed

X's default theme is **pure #000000**, which is the same black an avatar is
made of. So the whole problem with a black avatar is giving the circle an edge
in the one place it has none.

| Option | Verdict |
|---|---|
| **Black · large** | Reads at every size on every theme. The mark carries it, so the circle edge does not have to. |
| **Black · mono** | Same, with no accent. Cleanest at 24px. |
| **Black · outline** | A defined boundary at all sizes. Louder than it sounds. |
| Black | Fine, but quiet — the near-black edge is nearly invisible at 24px. |
| Black · ring | The ring dominates by 32px and starts reading as a spinner. |
| **True black** | Avoid. On Dark the circle vanishes completely and the chevrons float with no avatar around them. |

The ground is `#08090A`, not `#000000`, on purpose — see the last row.

The chevron gap is also wider in every black variant than in the app mark. At
24px the original one-unit gap was under a pixel and the two shapes closed into
a single blob.

### Earlier set

`x-avatar-mint`, `x-avatar-light`, `x-avatar-plate`, `x-avatar-ring` and
`x-avatar-bleed` are the first pass, compared in `preview-x.html`. Kept for
reference.

## Regenerating

`render-black.html` and `render.html` hold the source of every tile. Edit one,
then screenshot each `.tile` element at 1000×1000 — see the git history of this
folder for the exact snippet.

## Not made yet

The header banner (1500×500) and the Open Graph card (1200×630) that link
previews use. Ask if you want them.
