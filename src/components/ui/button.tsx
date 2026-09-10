import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary";
type Size = "md" | "lg";

const base =
  "inline-flex items-center gap-2 rounded-full font-semibold tracking-[-0.015em] " +
  "transition-[transform,background,box-shadow] duration-200 hover:-translate-y-px " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  // .b1 — white on black. One per screen: it is the single next action.
  primary:
    "bg-white text-bg shadow-[0_0_0_1px_rgba(255,255,255,.9),0_8px_26px_-12px_rgba(255,255,255,.32)] " +
    "hover:shadow-[0_0_0_1px_#fff,0_12px_32px_-12px_rgba(255,255,255,.46)]",
  // .b2 — everything else.
  secondary:
    "bg-surf-2 text-fg font-medium shadow-[inset_0_0_0_1px_var(--color-bd-2)] hover:bg-surf-3",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-[11px] text-[13.5px]",
  lg: "px-[26px] py-[14px] text-[15px]",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
