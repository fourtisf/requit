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

## Not made yet

The header banner (1500×500) and the Open Graph card (1200×630). Ask if you
want them.
