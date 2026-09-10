#!/usr/bin/env python3
"""
Rebuild preview.html from the mark SVGs and marks.json.

The SVG files are the source of truth: edit a mark, re-run this, and the sheet
follows. Written so the comparison sheet can never drift from what is on disk.

    python3 docs/brand/build.py
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
ACCENT = "#6BCBA5"

# Where a mark earns or loses the job. 19px is the nav; the light background is
# what decides whether it can go on an invoice or a letterhead.
SIZES = [(32, "32"), (19, "19 · nav")]


def inner(path: pathlib.Path) -> str:
    """The artwork inside the <svg> wrapper."""
    body = re.sub(r"^.*?<svg[^>]*>", "", path.read_text(), flags=re.S)
    return re.sub(r"</svg>\s*$", "", body).strip()


def render(art: str, size: int, uid: str) -> str:
    # Gradient ids are document-scoped, so every instance on the sheet needs
    # its own or they all resolve to the first one.
    art = re.sub(r'id="([A-Za-z0-9_-]+)"', rf'id="\1{uid}"', art)
    art = re.sub(r"url\(#([A-Za-z0-9_-]+)\)", rf"url(#\1{uid})", art)
    return f'<svg viewBox="0 0 32 32" width="{size}" height="{size}" aria-hidden="true">{art}</svg>'


def card(name: str, meta: dict, art: str) -> str:
    chips = "".join(
        f'<span class="chip">{render(art, px, f"{name}{px}")}<i>{label}</i></span>'
        for px, label in SIZES
    )
    chips += f'<span class="chip light">{render(art, 19, name + "L")}<i>on light</i></span>'
    return f"""
    <article class="card">
      <div class="stage">{render(art, 88, name + "big")}</div>
      <div class="lockup">{render(art, 22, name + "lock")}<span class="word">Requit</span></div>
      <div class="sizes">{chips}</div>
      <h3>{meta["title"]}</h3>
      <p>{meta["idea"]}</p>
      <code>docs/brand/mark-{name}.svg</code>
    </article>"""


def main() -> None:
    config = json.loads((HERE / "marks.json").read_text())
    sections = []

    for index, group in enumerate(config["sets"]):
        cards = [
            card(name, meta, inner(HERE / f"mark-{name}.svg"))
            for name, meta in config["marks"].items()
            if meta["set"] == index
        ]
        sections.append(
            f'<section><h2>{group["name"]}</h2><p class="note">{group["note"]}</p>'
            f'<div class="grid">{"".join(cards)}</div></section>'
        )

    (HERE / "preview.html").write_text(TEMPLATE.format(sections="".join(sections), accent=ACCENT))
    print(f"preview.html — {len(config['marks'])} marks")


TEMPLATE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Requit — logo candidates</title>
<style>
  :root {{ --bg:#08090A; --bg2:#0C0D0F; --bd:rgba(255,255,255,.075);
           --fg:#FBFBFA; --fg2:#9C9E9C; --fg4:#434645; }}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:var(--bg);color:var(--fg);
       font:16px/1.55 ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;
       letter-spacing:-.011em;padding:56px 40px 72px;
       background-image:radial-gradient(900px 460px at 50% -12%,rgba(107,203,165,.10),transparent 64%)}}
  header,section{{max-width:1180px;margin-inline:auto}}
  h1{{font-size:32px;font-weight:600;letter-spacing:-.042em}}
  .sub{{color:var(--fg2);font-size:14.5px;margin-top:10px;max-width:72ch;font-weight:300}}
  section{{margin-top:44px}}
  h2{{font-size:12.5px;font-weight:600;color:#95E0C1;letter-spacing:.015em}}
  .note{{color:var(--fg2);font-size:13px;margin-top:5px;max-width:70ch;font-weight:300}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:14px;margin-top:16px}}
  .card{{background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));
        border-radius:16px;padding:22px;box-shadow:inset 0 0 0 1px var(--bd)}}
  .stage{{height:132px;display:grid;place-items:center;background:var(--bg2);
         border-radius:11px;box-shadow:inset 0 0 0 1px var(--bd)}}
  .lockup{{display:flex;align-items:center;gap:9px;margin-top:14px;padding:11px 13px;
          border-radius:9px;background:rgba(255,255,255,.026);box-shadow:inset 0 0 0 1px var(--bd)}}
  .word{{font-size:15px;font-weight:600;letter-spacing:-.035em}}
  .sizes{{display:flex;gap:7px;margin-top:9px}}
  .chip{{flex:1;display:flex;flex-direction:column;align-items:center;gap:7px;padding:11px 4px;
        border-radius:9px;background:rgba(255,255,255,.026);box-shadow:inset 0 0 0 1px var(--bd)}}
  .chip.light{{background:#F4F5F3;box-shadow:inset 0 0 0 1px rgba(0,0,0,.09)}}
  .chip.light svg [stroke="#FBFBFA"]{{stroke:#14171A}}
  .chip.light svg [fill="#FBFBFA"]{{fill:#14171A}}
  .chip i{{font-style:normal;font-size:10px;color:var(--fg4);font-family:ui-monospace,monospace}}
  .chip.light i{{color:#7A8079}}
  h3{{font-size:15.5px;font-weight:600;letter-spacing:-.025em;margin-top:16px}}
  .card p{{color:var(--fg2);font-size:12.5px;line-height:1.55;margin-top:6px;font-weight:300}}
  code{{display:block;margin-top:12px;font-family:ui-monospace,monospace;font-size:10.5px;color:var(--fg4)}}
  .type{{max-width:1180px;margin:44px auto 0;padding:34px;border-radius:16px;
        background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.012));
        box-shadow:inset 0 0 0 1px var(--bd)}}
  .type h2{{color:var(--fg);font-size:15.5px;letter-spacing:-.025em}}
  .wm{{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-end;margin-top:24px}}
  .wm-box{{padding:24px 28px 32px;border-radius:11px;background:var(--bg2);
          box-shadow:inset 0 0 0 1px var(--bd)}}
  .wm-box.light{{background:#F4F5F3;color:#14171A}}
  .wm-l{{font-size:52px;font-weight:600;letter-spacing:-.055em;line-height:1}}
  .wm-s{{font-size:21px;font-weight:600;letter-spacing:-.04em;line-height:1}}
  .q{{position:relative;display:inline-block}}
  .q::after{{content:"";position:absolute;left:.055em;bottom:-.26em;width:.60em;height:.085em;
            border-radius:99px;background:{accent}}}
  .caveat{{margin-top:22px;padding:13px 15px;border-radius:9px;font-size:12px;line-height:1.55;
          color:#E8C68B;background:rgba(232,198,139,.08);
          box-shadow:inset 0 0 0 1px rgba(232,198,139,.2);max-width:78ch}}
</style></head>
<body>
  <header>
    <h1>Logo candidates</h1>
    <p class="sub">Same palette as the prototype, one accent each. Every mark is shown at 88px,
    as a lockup, at 19px — the size in the nav, where most marks fall apart — and on a light
    background, which is what decides whether it can go on an invoice.</p>
  </header>
  {sections}
  <section class="type">
    <h2>A direction, not a mark: let the name carry it</h2>
    <p class="note">Requit is one of the few names with a descender sitting in the middle of it.
    Carrying the <b>q</b> into the accent gives an identity nobody else can use, and it needs no
    symbol at all — which removes the whole problem of a mark that has to read at 19px.</p>
    <div class="wm">
      <div class="wm-box"><div class="wm-l">Re<span class="q">q</span>uit</div></div>
      <div class="wm-box light"><div class="wm-l">Re<span class="q">q</span>uit</div></div>
      <div class="wm-box"><div class="wm-s">Re<span class="q">q</span>uit</div></div>
    </div>
    <p class="caveat">Approximated in CSS with a system sans — judge the idea, not the execution.
    A real wordmark is drawn: the q's descender itself thickens and turns, rather than having a
    bar parked underneath it. That needs outlining from a licensed typeface.</p>
  </section>
</body></html>"""

if __name__ == "__main__":
    main()
