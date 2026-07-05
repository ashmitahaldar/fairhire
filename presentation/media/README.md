# Demo media

Drop demo recordings here (GIF or MP4), then reference them from a slide in
`../index.html`. There's a ready-to-uncomment template right after the Decision
Companion slide (search the file for **"DEMO GIF slot"**).

## How to add a clip

1. Record a short screen capture (e.g. the flag-reveal Replay, the HR nudges strip).
   - **macOS:** `Shift-Cmd-5` records a region to `.mov`.
2. Save it here, e.g. `companion.gif` / `companion.mp4` / `hr-nudges.gif`.
3. In `../index.html`, uncomment (or copy) the template `<section>` and set `src` +
   caption:
   ```html
   <section class="fh-media-slide" data-background-color="#F6F4EF">
     <img src="media/companion.gif" alt="Decision Companion — flags streaming in" />
     <p class="fh-media-cap">Decision Companion — flags stream in as the transcript is analysed</p>
   </section>
   ```

## GIF vs MP4

- **GIF** — simplest; autoplays and loops with no attributes. Can get large (10–30 MB).
- **MP4** — sharper and much smaller. Use the `<video>` variant in the template
  (`data-autoplay loop muted playsinline`). reveal.js only autoplays videos on the
  active slide, which is usually what you want.

## Making a GIF from a screen recording

```bash
# from an .mov/.mp4 → optimised GIF (needs ffmpeg + gifski, or just ffmpeg):
ffmpeg -i companion.mov -vf "fps=15,scale=1280:-1:flags=lanczos" companion.gif
```

Keep clips short (5–10s) and loopable — they run while you talk over them.
