import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Spinner } from "./Spinner";

type Variant = "default" | "primary" | "danger" | "ghost" | "link";
type Size = "md" | "sm";

const cls = (variant: Variant, size: Size, icon: boolean, block?: boolean, extra?: string) =>
  [
    "btn",
    variant !== "default" && `btn-${variant}`,
    size === "sm" && "btn-sm",
    icon && "btn-icon",
    block && "btn-block",
    extra
  ]
    .filter(Boolean)
    .join(" ");

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", loading, icon, block, children, className, disabled, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cls(variant, size, !children && !!icon, block, [loading && "is-loading", className].filter(Boolean).join(" "))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {/* The content keeps its place while loading, so the button never changes size */}
      {icon}
      {children}
      {loading && (
        <span className="btn-spinner">
          <Spinner />
        </span>
      )}
    </button>
  );
});

/* A router link styled as a button */
export function ButtonLink({
  variant = "default",
  size = "md",
  icon,
  children,
  className,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: ReactNode }) {
  return (
    <Link className={cls(variant, size, !children && !!icon, false, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
