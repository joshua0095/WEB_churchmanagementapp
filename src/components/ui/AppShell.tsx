import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canAccessModule } from "../../auth";
import { infoAlert } from "../../swal";
import IconButton from "./IconButton";
import {
  AnnouncementsIcon,
  AttendanceIcon,
  DevotionIcon,
  HomeIcon,
  MenuIcon,
  ReportsIcon,
  SettingsIcon,
  UserListIcon,
} from "./icons";
import Logo from "./Logo";

interface NavItem {
  label: string;
  icon: ReactNode;
  to?: string;
  /** Ministry-configurable module this nav item belongs to — hidden if the user's ministries don't grant access. Omit for items everyone always sees. */
  module?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: <HomeIcon />, to: "/" },
  { label: "Devotion", icon: <DevotionIcon />, to: "/devotion" },
  { label: "Attendance", icon: <AttendanceIcon />, to: "/attendance", module: "Attendance" },
  { label: "Reports", icon: <ReportsIcon />, to: "/reports", module: "Reports" },
  { label: "Announcements", icon: <AnnouncementsIcon />, to: "/announcements", module: "Announcements" },
  { label: "People", icon: <UserListIcon />, to: "/people", module: "People" },
  { label: "Settings", icon: <SettingsIcon />, to: "/settings" },
];

interface AppShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
}

/**
 * Authenticated app layout: a persistent left sidebar on desktop that
 * collapses into an off-canvas hamburger drawer on mobile.
 */
function AppShell({ children, headerRight }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const go = (item: NavItem) => {
    if (item.to) {
      navigate(item.to);
    } else {
      void infoAlert(`${item.label} — coming soon`);
    }
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <nav className={["app-sidebar", menuOpen && "app-sidebar--open"].filter(Boolean).join(" ")}>
        <div className="flex flex-col items-center gap-2.5">
          <Logo size={150} />
          <p className="m-0 text-center font-display text-[1.05rem] font-semibold leading-tight">
            JIL Norzagaray Connect
          </p>
        </div>
        <ul className="app-sidebar-nav">
          {NAV_ITEMS.filter((item) => !item.module || canAccessModule(item.module)).map((item) => (
            <li key={item.label}>
              <button
                type="button"
                className={["app-sidebar-link", item.to === location.pathname && "active"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => go(item)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {menuOpen && (
        <div
          className="app-sidebar-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="app-main">
        <header className="app-topbar">
          <IconButton
            className="app-menu-toggle"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <div className="app-topbar-actions">{headerRight}</div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}

export default AppShell;
