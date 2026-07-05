# FairHire — Showcase presentation

Everything for the UBS Talent Program showcase lives here.

| File | What it is |
|---|---|
| `index.html` | The slide deck (reveal.js), styled as FairHire. 14 slides. |
| `fairhire.css` | The FairHire theme (editorial palette, Source Serif / Inter / JetBrains Mono). |
| `DEMO-SCRIPT.md` | Shot-by-shot guide for recording the ~3-min product demo video. |
| `vendor/reveal/` | Vendored reveal.js 6 (so the deck runs with no network). |
| `fonts/` | Self-hosted Source Serif 4 / Inter / JetBrains Mono (OFL-1.1) — the deck's fonts, offline. |

## Presenting the deck

Serve the folder (the speaker-notes window needs `http://`, not `file://`):

```bash
npx serve presentation          # then open the printed http://localhost URL
# or:  cd presentation && python3 -m http.server 8080   → http://localhost:8080
```

**Keys:** `→` / `Space` next · `←` back · `F` fullscreen · **`S` speaker notes** (opens a
second window with your talk-track, a timer, and the next slide — put it on your laptop,
the deck on the projector) · `O` slide overview · `B` blank screen · `?` all shortcuts.

The **thought-process talk-track** is in the speaker notes on every slide — press `S`.

## The story (14 slides)

Title → the problem (bias hides in *language*) → the reframe (mirror, not cop) → the
trust contract → the three surfaces (Decision Companion · Pattern Mirror · HR Overview) →
the hybrid engine → **privacy by construction** → evaluation → the four hard calls →
architecture → what's next → close.

**Running short (~5 min)?** Skip slides **8 (engine)**, **10 (eval)**, and **12
(architecture)** — the narrative still holds.

## Adding demo GIFs / video between slides

Yes — reveal.js plays GIFs and video natively. Record a clip, drop it in `media/`, and
uncomment the ready-made template right after the Decision Companion slide (search
`index.html` for **"DEMO GIF slot"**). GIFs autoplay and loop on their own; for a sharper,
smaller file use the `<video>` variant (reveal only autoplays it on the active slide).
Full instructions in `media/README.md`. Copy the block to place a clip anywhere.

## Self-running / auto-play (booth, unattended screen, or recording)

Open **`autoplay.html`** (double-clickable) — or add `?autoplay` to the deck URL —
and it advances through every fragment and slide on a timer, then loops. Set the pace
with `?autoplay=5000` (ms per step; default 5000). Click any slide to pause; the
controls still work.

```
http://localhost:8080/?autoplay=5000     # 5s per step, loops
```

Without the param the deck stays fully manual — the auto-play mode is opt-in, so it
never self-advances during a live talk. To hand someone a **video** file, run the
auto-play version fullscreen and screen-record one pass.

## Export a PDF (portable backup)

Open the deck with `?print-pdf` appended to the URL, then Print → Save as PDF (enable
"Background graphics"):

```
http://localhost:8080/?print-pdf
```

## Editing

- Each slide is a `<section>` in `index.html`; add `class="fragment"` to reveal an element
  on the next key press; put talk-track in `<aside class="notes">`.
- Colours, fonts and the recreated UI motifs (flag card, nudge strip, chart) live in
  `fairhire.css` — all driven by the same OKLCH tokens as the real app.
- Fonts are **self-hosted** in `fonts/` (Source Serif 4 / Inter / JetBrains Mono, variable
  woff2, OFL-1.1) and declared via `@font-face` in `fairhire.css` — the deck renders the
  exact product typefaces with **no network at all**. Georgia / system-ui / Menlo remain
  only as ultimate fallbacks.
