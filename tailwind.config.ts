import type { Config } from "tailwindcss";

export default {
    content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
                mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
            },
            colors: {
                ink: {
                    950: "#07090d",
                    900: "#0b0f15",
                    850: "#10151d",
                    800: "#151b25",
                    700: "#1f2733",
                    600: "#2b3544",
                },
                brand: {
                    300: "#7ee7c7",
                    400: "#3fd9a8",
                    500: "#19c08c",
                    600: "#0f9c71",
                },
            },
            keyframes: {
                "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } },
                scan: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(300%)" } },
            },
            animation: {
                "fade-up": "fade-up .35s ease-out both",
                scan: "scan 1.4s ease-in-out infinite",
            },
        },
    },
    plugins: [],
} satisfies Config;
