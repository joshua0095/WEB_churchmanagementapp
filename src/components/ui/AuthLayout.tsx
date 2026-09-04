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
        <div className="flex flex-col items-center gap-1.5 mb-1">
          <Logo size={140} />
          <p className="m-0 text-center font-display text-[1.35rem] font-semibold tracking-[0.2px]">
            JIL Norzagaray Connect
          </p>
        </div>
        <h1 className="auth-title">{title}</h1>
        {children}
        <div className="auth-footer">{footer}</div>
      </div>
    </div>
  );
}

export default AuthLayout;
