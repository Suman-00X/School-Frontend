import type { ReactNode } from "react";
import { BRAND_ICON } from "@/app/navigation";

/* The centred card used by sign-in and the password-link pages (no session, so no school logo) */
export function AuthLayout({
  title,
  subtitle,
  schoolCode,
  footer,
  children
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  schoolCode?: string | null;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const Brand = BRAND_ICON;
  return (
    <div className="auth-page">
      <main className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">
            <Brand size={18} />
          </span>
          <span>
            School portal
            {schoolCode && <span className="muted mono" style={{ marginLeft: 8 }}>{schoolCode}</span>}
          </span>
        </div>
        <div className="stack-sm">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </main>
    </div>
  );
}
