# Social images

## X profile picture

Upload **`x-avatar-mint.png`** or **`x-avatar-light.png`** at 1000×1000. X crops
to a circle and downsamples.

Open `preview-x.html` to see every option at the sizes X actually renders — 112,
48, 32 and 24 — across its three themes.

### What the test showed

X renders the avatar at 24–48px almost everywhere except the profile page, and
its default theme is pure black. That combination decides this, not how the
image looks at full size:

| Option | Verdict |
|---|---|
| **Mint** | Works at every size on every theme. Loudest in a timeline. |
| **Light** | Works everywhere too, and reads calmer than Mint. |
| Plate | **Fails on Dark** — a near-black circle on a black background has no edge at any size. Fine on Light and Dim. |
| Ring | The hairline helps at 112px and is gone by 32px. Same failure as Plate. |
| Bleed | Strong large, but the two chevrons start to merge by 24px. |

Plate and Ring are kept because they are correct on Light and Dim — but X's
default is Dark, so neither should be the one that ships.

## Regenerating

`render.html` holds the source of every tile. Edit it, then:

```bash
node -e '
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
  await p.goto("file://" + process.cwd() + "/render.html");
  for (const id of ["plate", "mint", "light", "ring", "bleed"])
    await (await p.$("#" + id)).screenshot({ path: `x-avatar-${id}.png` });
  await b.close();
})();'
```

## Not made yet

The header banner (1500×500) and the Open Graph card (1200×630) that link
previews use. Ask if you want them.
