import { type ReactNode } from "react";
import Logo from "./Logo";

interface AppHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

/** Navy top bar used on authenticated app screens; defaults to a centered wordmark. */
function AppHeader({ left, center, right }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-slot app-header-slot--left">{left}</div>
      <div className="app-header-slot app-header-slot--center">
        {center ?? <Logo size={34} />}
      </div>
      <div className="app-header-slot app-header-slot--right">{right}</div>
    </header>
  );
}

export default AppHeader;
