/* ─────────────────────────────────────────────────────────────
   FairHire — tailwind.config.ts
   Maps Tailwind utilities to the CSS variables defined in
   globals.css. No hex codes here — every color resolves to a
   token. Add a new color? Add it to globals.css first.
   ───────────────────────────────────────────────────────────── */

import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // semantic surfaces
        bg:               "var(--color-bg)",
        surface:          "var(--color-surface)",
        "surface-sunk":   "var(--color-surface-sunk)",
        "surface-active": "var(--color-surface-active)",

        // lines
        hairline:         "var(--color-border)",
        "hairline-strong":"var(--color-border-strong)",

        // text — semantic
        ink:              "var(--color-text-primary)",
        "ink-secondary":  "var(--color-text-secondary)",
        "ink-tertiary":   "var(--color-text-tertiary)",
        "ink-inverse":    "var(--color-text-inverse)",

        // single accent
        accent:           "var(--color-accent)",
        "accent-soft":    "var(--color-accent-soft)",

        // flag severities (semantic — not for chrome)
        "flag-high":      "var(--color-flag-high)",
        "flag-med":       "var(--color-flag-med)",
        "flag-low":       "var(--color-flag-low)",

        // race-segment fills for the Demographics pipeline (Phase C).
        // Inline `style={{background: var(...)}}` is the primary consumer
        // since the chart iterates a programmatic key list; these utilities
        // are here for completeness so the tokens are also usable via
        // `bg-segment-*` in static markup.
        segment: {
          chinese: "var(--color-segment-chinese)",
          malay:   "var(--color-segment-malay)",
          indian:  "var(--color-segment-indian)",
          other:   "var(--color-segment-other)",
          unknown: "var(--color-segment-unknown)",
        },

        // shadcn pass-through (compat)
        background:       "var(--background)",
        foreground:       "var(--foreground)",
        card: {
          DEFAULT:        "var(--card)",
          foreground:     "var(--card-foreground)",
        },
        popover: {
          DEFAULT:        "var(--popover)",
          foreground:     "var(--popover-foreground)",
        },
        primary: {
          DEFAULT:        "var(--primary)",
          foreground:     "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT:        "var(--secondary)",
          foreground:     "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT:        "var(--muted)",
          foreground:     "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT:        "var(--destructive)",
          foreground:     "var(--destructive-foreground)",
        },
        border:           "var(--border)",
        input:            "var(--input)",
        ring:             "var(--ring)",
      },

      fontFamily: {
        serif: ["Source Serif 4", "Source Serif Pro", "Georgia", "serif"],
        sans:  ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono:  ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },

      // Type scale: 12 / 13 / 15 / 16 / 18 / 22 / 32 / 44
      fontSize: {
        meta:    ["0.75rem",   { lineHeight: "1rem",     letterSpacing: "0.06em" }],
        xs:      ["0.8125rem", { lineHeight: "1.125rem" }],
        sm:      ["0.9375rem", { lineHeight: "1.375rem" }],
        base:    ["1rem",      { lineHeight: "1.5rem"   }],
        body:    ["1.125rem",  { lineHeight: "1.6875rem" }],
        section: ["1.375rem",  { lineHeight: "1.875rem" }],
        page:    ["2rem",      { lineHeight: "2.5rem"   }],
        display: ["2.75rem",   { lineHeight: "3rem"     }],
      },

      // Spacing scale (Tailwind already exposes 1,2,3,4,6,8,12,16,24 = 4/8/12/16/24/32/48/64/96 in px).
      // We intentionally do NOT add new spacing tokens — staying with Tailwind's defaults at this
      // scale is the discipline.

      borderRadius: {
        card:  "2px",
        input: "1px",
      },

      letterSpacing: {
        meta: "0.06em",
      },

      boxShadow: {
        float: "var(--shadow-float)",
      },

      transitionTimingFunction: {
        quiet: "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        "120": "120ms",
        "160": "160ms",
        "200": "200ms",
        "240": "240ms",
      },

      maxWidth: {
        // editorial reading measure for transcript
        prose: "40rem",      // 640px
        // page shells
        companion: "70.5rem", // 1128px
        mirror: "73.75rem",   // 1180px
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // typography plugin only if/when we render long-form markdown elsewhere
  ],
};

export default config;
