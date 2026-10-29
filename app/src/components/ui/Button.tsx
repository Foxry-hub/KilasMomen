import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const variantStyles: Record<Variant, string> = {
  primary: "bg-brand-yellow",
  secondary: "bg-white",
  success: "bg-brand-green",
  danger: "bg-brand-red",
  ghost: "bg-transparent",
};

const sizeStyles: Record<Size, string> = {
  xs: "h-9 px-3 text-xs border-2 shadow-brut-sm",
  sm: "h-11 px-4 text-sm border-2 shadow-brut-sm",
  md: "h-16 px-6 text-xl border-4 shadow-brut",
  lg: "h-24 px-8 text-2xl border-4 shadow-brut-lg",
  xl: "h-28 px-10 text-3xl border-4 shadow-brut-xl w-full",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "lg",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={[
        // Base
        "inline-flex items-center justify-center gap-3",
        "border-ink font-display uppercase leading-none tracking-tight",
        "select-none cursor-pointer",
        // Press effect
        "active:translate-x-1 active:translate-y-1 active:shadow-none",
        // Disabled
        "disabled:disabled-stripes disabled:cursor-not-allowed",
        "disabled:active:translate-x-0 disabled:active:translate-y-0",
        // Transition
        "transition-transform duration-100",
        // Variant + Size
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
