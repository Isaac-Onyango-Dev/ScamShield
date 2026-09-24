import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "plain";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover",
    secondary: "border border-line-strong bg-surface text-fg hover:bg-surface-2",
    plain: "text-accent hover:text-accent-hover hover:underline",
};

const SIZES: Record<Size, string> = {
    sm: "h-8 gap-1 px-3 text-footnote",
    md: "h-10 gap-2 px-4 text-footnote",
    lg: "h-12 gap-2 px-5 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    size?: Size;
}

/** The one button. Plain buttons have no box, so they drop horizontal padding. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "secondary", size = "md", className, type = "button", ...props }, ref) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-md font-semibold transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-50",
                VARIANTS[variant],
                SIZES[size],
                variant === "plain" && "px-0",
                className,
            )}
            {...props}
        />
    );
});
