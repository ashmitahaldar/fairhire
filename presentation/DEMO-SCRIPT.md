# FairHire — Demo video script

A ~2.5–3 minute screen recording of the **real app**. The product already has the
animations that sell it (the flag-reveal stream + **Replay**, the live analysis
counter, the HR nudges strip) — this script just choreographs them and tells you the
exact numbers to point at. Record the real thing; don't fake it.

---

## Pre-flight (do this once, the morning of)

1. **Reseed** so all dates land in the trailing 90-day window:
   ```bash
   npm run seed:reset
   ```
   This builds **Meridian Capital Partners** — 6 divisions, 5 managers, 10 candidates,
   12 debriefs, 34 flags. Dates anchor to *now*, so the Pattern Mirror and HR Overview
   (both default to "Last 90 days") are populated.

2. **Run both servers** (two terminals):
   ```bash
   npm run dev:api   # http://localhost:3001
   npm run dev:web   # http://localhost:5173
   ```

3. **Point your logins at the seeded data.** Seeded managers use placeholder Clerk IDs
   (`seed_user_*`), so a fresh sign-in creates an *empty* manager. To demo the rich
   manager surfaces, repoint two seeded rows to your two real Clerk accounts:

   - Sign in once with each of your two Clerk accounts (this creates a row per account),
     then grab each account's real Clerk user id (`user_…`) from the Clerk dashboard, or
     from **`npm run db:studio`** → `managers` table (the freshly-created rows).
   - Repoint the seeded manager + HR rows to those ids. Easiest in `db:studio` (edit the
     `clerkUserId` cell), or via SQL in the Supabase editor:
     ```sql
     -- account you'll demo as the MANAGER (richest data: 4 flagged debriefs)
     UPDATE managers SET clerk_user_id = 'user_YOUR_MANAGER_ID'
       WHERE email = 'wei.tan@meridian-capital.sg';
     -- account you'll demo as HR
     UPDATE managers SET clerk_user_id = 'user_YOUR_HR_ID'
       WHERE email = 'sarah.wong@meridian-capital.sg';
     ```
     (Optionally delete the two empty auto-created rows afterwards.)

   > **Note:** HR Overview works even from a fresh `hr_admin` account, because it reads
   > *org-wide* aggregates and a new sign-in joins the seeded org. Only the per-manager
   > surfaces (Decision Companion, Pattern Mirror) need the repoint above.

4. **Recording setup:** 1920×1080, browser zoom so text is comfortably large, hide the
   bookmarks bar, close other tabs. Have **two browser windows** side-loaded: one signed
   in as **Wei Liang Tan** (manager), one as **Sarah Wong** (HR). Turn on cursor
   highlighting if your recorder supports it.

---

## The shots

Times are approximate. Narration lines are a starting point — say them in your own words.

### Shot 1 — Open on a debrief · ~0:00–0:15
- **Screen:** Manager window → **Dashboard**. Click into one of Wei's analysed debriefs
  (or open it from **Candidates → a name → Open debrief**). You land on `/meetings/:id`.
- **Say:** *"After every interview, a manager pastes their debrief notes here. FairHire
  reads the transcript and reflects back the language that might be shifting the bar —
  privately, just for them."*

### Shot 2 — The money shot: flags stream in · ~0:15–0:35
- **Screen:** On the debrief, click **Replay** (top-right, appears once analysis is
  complete). The headline counter climbs 0 → N while the flag cards reveal one by one and
  the transcript spans light up.
- **Say:** *"The flags surface with the exact quote, why it was raised, and a fairer way
  to put it. Nothing here leaves this manager's own view."*
- **Alt (more authentic, needs `OPENAI_API_KEY`):** instead of Replay, go to **Upload**,
  paste the sample transcript in the appendix, hit **Upload & analyse**, and let the live
  counter + progress bar run (~1 min) before the reveal.

### Shot 3 — Walk one flag · ~0:35–1:05
- **Screen:** Hover a flag card → its transcript span thickens (and vice-versa). Expand a
  card to show the **quote → reasoning → Suggested alternative**. Point at a **High**
  severity badge. **Dismiss** one flag with a reason. Then set the decision in the panel
  (Hired / Pending / Declined).
- **Say:** *"Each flag is explainable and rewritable — it's coaching, not a red mark. And
  if the manager disagrees, they dismiss it with a reason. That disagreement becomes a
  signal HR can see in aggregate — I'll come back to that."*

### Shot 4 — Pattern Mirror · ~1:05–1:35
- **Screen:** Nav → **Pattern Mirror**. Show the editorial summary sentence, the
  **timeline** (bars = flags per interview, dashed rolling average, oxblood dots = hires),
  the **top flag categories**, and the **"three nudges from your own data"** strip.
- **Say:** *"One debrief is a moment; this is the trend. A manager who'd never notice a
  single flag can see, across all their interviews, which patterns keep recurring — still
  completely private to them."*

### Shot 5 — The privacy boundary, on screen · ~1:35–1:55
- **Screen:** Nav → **Candidates** → click a candidate name → the detail dialog. Point at
  the org-wide flag count and read the privacy-boundary line: *"including other managers'
  debriefs… their content stays private."*
- **Say:** *"Even the counts respect the boundary — a manager sees that other debriefs
  exist, but never their contents."*

### Shot 6 — HR Overview lights up · ~1:55–2:35  *(the payoff)*
- **Screen:** Switch to the **HR window** (Sarah Wong) → nav shows **HR Overview** (only
  HR sees this link) → `/hr`. Land on **"Patterns worth a closer look"** — three nudge
  cards. Read them, pointing at each:
  1. **Representation** — *"Hires this period were **100% majority background** vs an
     applied pool of **30%**."*
  2. **Language** — *"**'Shifting criteria'** is the most-flagged category — **2.1×** the
     next most common."*
  3. **Calibration** — *"**'Energy / pace'** flags are dismissed **67% of the time** —
     4 of 6."* (this is the manager dismissals from Shot 3, now aggregated)
- **Say:** *"Same engine, org-wide, fully anonymised. HR sees the pattern — hires skewing
  from the applied pool, a category dominating, a signal managers keep waving off — but
  never the person. No manager is named anywhere on this screen."*
- Optionally hover the header line: *"Aggregated and anonymised — no individual manager is
  identifiable here."*

### Shot 7 — Close · ~2:35–2:50
- **Screen:** Rest on the HR Overview, or cut back to the Pattern Mirror.
- **Say:** *"A private mirror for the manager, an anonymised lens for HR — and the line
  between them is enforced by the database itself, not just promised. Bias you can see is
  bias you can change."*

---

## Word-for-word voiceover

Read this straight through while you record. It's ~2.7 min at a normal pace (~145 words
a minute) — slow down and pause on the bracketed cues so the on-screen animation has room
to breathe. The `[cues]` are for you; don't read them aloud. Trim any sentence that runs
long against your footage.

> **[Shot 1 — open a debrief]**
> This is FairHire. After an interview, a manager drops their debrief notes in here, and
> the tool reads the transcript for the kind of language that quietly shifts the bar — the
> phrases that sound reasonable in the moment but don't hold up across candidates.
>
> **[Shot 2 — hit Replay; flags stream in]**
> When the analysis runs, the flags surface one at a time, and each one points to the exact
> phrase it picked up on. This is only ever visible to the manager who wrote the notes —
> nobody else in the company sees it.
>
> **[Shot 3 — expand a flag, dismiss one, set the decision]**
> If I open one up, I get the quote, a plain explanation of why it was flagged, and a fairer
> way to say the same thing — so it's not marking you wrong, it's offering you a rewrite. And
> if I think it's got it wrong, I dismiss it and give a reason. That disagreement isn't
> wasted; it feeds back in later. Then I record the actual decision.
>
> **[Shot 4 — Pattern Mirror]**
> That was one interview. This is the same manager across all of theirs. A single flag is
> easy to shrug off, but over time you can see which patterns keep coming back — and whether
> they land harder on some groups than others. It's a mirror, and it stays completely
> private to them.
>
> **[Shot 5 — candidate dialog + privacy line]**
> Even the candidate view respects that line. You can see that other managers have
> interviewed this person too, but you never see what they wrote.
>
> **[Shot 6 — switch to the HR account; the nudges strip]**
> Now I'll switch to an HR login. HR gets a completely different view — the whole
> organisation, fully anonymised. No manager is named anywhere on this screen. And three
> things stand out right away. Everyone hired this period came from the majority background,
> even though they were only thirty percent of applicants. One kind of concern — shifting the
> criteria mid-process — is coming up more than twice as often as anything else. And a third
> pattern, energy-and-pace language, gets waved off by managers two-thirds of the time, which
> tells HR that signal might not be landing. HR sees the pattern; it never sees the person.
>
> **[Shot 7 — close]**
> So that's FairHire — a private mirror for the manager, an anonymised view for HR, and the
> wall between them built into the database itself, not just written into a policy. Bias is
> hard to fix, but it's a lot easier to change once you can actually see it.

---

## Tips & fallbacks
- **The Replay button** is your friend — it re-triggers the flag-reveal animation as many
  takes as you need without re-analysing.
- If a manager surface looks thin, double-check you're signed in as the **repointed**
  seeded manager (Wei), not a fresh account.
- HR nudges are deterministic on the seeded data — if a number looks off, you likely
  demoed before `seed:reset`, or more than ~90 days after seeding (re-seed).
- Keep it moving: the three HR numbers are the emotional peak — linger there, rush nothing
  else.

---

## Appendix — sample transcript (for the live-upload version of Shot 2)

Paste into **Upload → transcript**. Contains several deliberate bias patterns; with
`OPENAI_API_KEY` set you'll get a rich set of flags. (Names fictional.)

```
Panel debrief — Senior Analyst — candidate: R. Kumar

Interviewer A: Technically he's strong. Modelling was clean, got through the case fast.
Interviewer B: Agreed on the technicals. My hesitation is more of a culture-fit thing —
  I'm not sure he'd gel with the desk.
Interviewer A: I did wonder about his accent — might be hard for some clients to follow
  on a call. We didn't raise that for the other two candidates, to be fair.
Interviewer B: Right. And he's a bit older than the rest of the pipeline — I'd question
  whether he's got the energy for the pace we run at.
Interviewer A: He was polished, but I couldn't put my finger on it — just didn't feel
  like a natural fit. Earlier we said we wanted raw hustle; now I'm leaning more towards
  someone who's the finished article.
Interviewer B: So where does that leave us — lean no?
Interviewer A: Lean no, I think. Hard to say exactly why.
```
