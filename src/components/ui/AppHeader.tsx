import { type ReactNode } from "react";
import Logo from "./Logo";

interface AppHeaderProps {
  title?: string;
  actions?: ReactNode;
}

/** Navy top bar used on authenticated app screens. */
function AppHeader({ title, actions }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <Logo size={32} />
        {title && <span className="app-header-title">{title}</span>}
      </div>
      {actions && <div className="app-header-actions">{actions}</div>}
    </header>
  );
}

export default AppHeader;
