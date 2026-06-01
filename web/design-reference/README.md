# Design reference

Source mockups for the FairHire screens — kept here for posterity, but
not part of the build. They sit outside `web/src/` so Vite and
TypeScript never see them.

- `mirror-app.jsx`, `mirror-charts.jsx`, `mirror-components.jsx` —
  initial single-file JSX renders of the Pattern Mirror screen. Ported
  to typed React components under
  `web/src/components/pattern-mirror/` during week 3.
- `Flag Review Screen.html`, `Pattern Mirror.html` — standalone HTML
  preview pages from the design tool, useful for diffing the visual
  contract against the live screens.

This folder is gitignored. Anything dropped here after the initial
commit won't be tracked unless you `git add -f`.
