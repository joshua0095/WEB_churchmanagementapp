import { type ReactNode } from "react";
import Logo from "./Logo";

interface AuthLayoutProps {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Shared navy branded card used by the Log In and Sign Up screens. */
function AuthLayout({ title, children, footer }: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Logo size={140} />
        </div>
        <h1 className="auth-title">{title}</h1>
        {children}
        <div className="auth-footer">{footer}</div>
      </div>
    </div>
  );
}

export default AuthLayout;
