import type { Config } from "tailwindcss";

/**
 * Every value maps to a CSS custom property in client/src/styles/tokens.css
 * (docs/REDESIGN_PLAN.md §3). Components never use raw colours, sizes or durations.
 */
const tokens = {
    colors: {
        transparent: "transparent",
        current: "currentColor",
        inherit: "inherit",
        canvas: "var(--color-bg)",
        surface: { DEFAULT: "var(--color-surface)", 2: "var(--color-surface-2)" },
        fg: { DEFAULT: "var(--color-text)", secondary: "var(--color-text-secondary)", tertiary: "var(--color-text-tertiary)" },
        line: { DEFAULT: "var(--color-border)", strong: "var(--color-border-strong)" },
        accent: { DEFAULT: "var(--color-accent)", hover: "var(--color-accent-hover)", tint: "var(--color-accent-tint)" },
        "on-accent": "var(--color-on-accent)",
        success: { DEFAULT: "var(--color-success)", tint: "var(--color-success-tint)" },
        warning: { DEFAULT: "var(--color-warning)", tint: "var(--color-warning-tint)" },
        danger: { DEFAULT: "var(--color-danger)", tint: "var(--color-danger-tint)" },
        "on-danger": "var(--color-on-danger)",
        focus: "var(--color-focus)",
    },
    fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
    },
    fontSize: Object.fromEntries(
        ["caption", "footnote", "body", "headline", "title-3", "title-2", "title-1", "display"].map((step) => [
            step,
            [`var(--font-size-${step})`, { lineHeight: `var(--line-height-${step})` }],
        ]),
    ) as Record<string, [string, { lineHeight: string }]>,
    // 4px base, 8px rhythm; `px` is for hairlines only.
    spacing: { 0: "0", px: "1px", 1: "4px", 2: "8px", 3: "12px", 4: "16px", 5: "20px", 6: "24px", 8: "32px", 10: "40px", 12: "48px", 14: "56px", 16: "64px", 20: "80px" },
    borderRadius: { none: "0", sm: "var(--radius-sm)", md: "var(--radius-md)", lg: "var(--radius-lg)", full: "9999px" },
    transitionDuration: { DEFAULT: "var(--duration-base)", fast: "var(--duration-fast)", base: "var(--duration-base)", slow: "var(--duration-slow)" },
    transitionTimingFunction: { DEFAULT: "var(--ease-standard)", standard: "var(--ease-standard)", exit: "var(--ease-exit)" },
    boxShadow: { none: "none", overlay: "var(--shadow-overlay)" },
    animation: { none: "none", "fade-in": "fade-in var(--duration-base) var(--ease-standard) both" },
    keyframes: {},
};

export default {
    content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
    // The token scales REPLACE Tailwind's defaults, so off-scale utilities (text-sm, mt-0.5,
    // palette colours, rounded-2xl, long durations…) don't exist. scripts/lint-design.mjs guards
    // arbitrary values.
    theme: tokens,
    plugins: [],
} satisfies Config;
