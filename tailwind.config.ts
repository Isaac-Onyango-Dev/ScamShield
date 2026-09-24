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
    theme: {
        // Legacy palette and animations remain available until the P6 cleanup sweep, when the
        // token scales move from `extend` to overriding the theme outright.
        extend: {
            ...tokens,
            fontFamily: {},
            colors: {
                ...tokens.colors,
                ink: { 950: "#07090d", 900: "#0b0f15", 850: "#10151d", 800: "#151b25", 700: "#1f2733", 600: "#2b3544" },
                brand: { 300: "#7ee7c7", 400: "#3fd9a8", 500: "#19c08c", 600: "#0f9c71" },
            },
            keyframes: {
                "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
                scan: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } },
            },
            animation: { ...tokens.animation, "fade-up": "fade-up .35s ease-out both", scan: "scan 1.4s ease-in-out infinite" },
        },
        fontFamily: tokens.fontFamily,
    },
    plugins: [],
} satisfies Config;
