import { type ReactNode, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canAccessModule } from "../../auth";
import { infoAlert } from "../../swal";
import IconButton from "./IconButton";
import {
  AnnouncementsIcon,
  AttendanceIcon,
  ChevronDownIcon,
  DevotionIcon,
  HomeIcon,
  MenuIcon,
  ReportsIcon,
  SettingsIcon,
  UserListIcon,
} from "./icons";
import Logo from "./Logo";

interface NavChild {
  label: string;
  to: string;
}

interface NavItem {
  label: string;
  icon: ReactNode;
  to?: string;
  /** Ministry-configurable module this nav item belongs to — hidden if the user's ministries don't grant access. Omit for items everyone always sees. */
  module?: string;
  /** Sub-links shown in an expandable group under this item instead of it navigating directly. */
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", icon: <HomeIcon />, to: "/" },
  { label: "Devotion", icon: <DevotionIcon />, to: "/devotion" },
  { label: "Attendance", icon: <AttendanceIcon />, to: "/attendance", module: "Attendance" },
  { label: "Reports", icon: <ReportsIcon />, to: "/reports", module: "Reports" },
  { label: "Announcements", icon: <AnnouncementsIcon />, to: "/announcements", module: "Announcements" },
  {
    label: "People",
    icon: <UserListIcon />,
    module: "People",
    children: [
      { label: "Workers", to: "/people/workers" },
      { label: "Congregation", to: "/people/congregation" },
    ],
  },
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
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  const isChildActive = (item: NavItem) => item.children?.some((c) => c.to === location.pathname) ?? false;
  const isExpanded = (item: NavItem) => manualExpanded[item.label] ?? isChildActive(item);

  const goTo = (to: string) => {
    navigate(to);
    setMenuOpen(false);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.children) {
      setManualExpanded((prev) => ({ ...prev, [item.label]: !isExpanded(item) }));
      return;
    }
    if (item.to) {
      goTo(item.to);
    } else {
      void infoAlert(`${item.label} — coming soon`);
      setMenuOpen(false);
    }
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
                className={["app-sidebar-link", !item.children && item.to === location.pathname && "active"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => handleItemClick(item)}
                aria-expanded={item.children ? isExpanded(item) : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.children && (
                  <ChevronDownIcon
                    className={["ml-auto h-4 w-4 transition-transform", isExpanded(item) && "rotate-180"]
                      .filter(Boolean)
                      .join(" ")}
                  />
                )}
              </button>
              {item.children && isExpanded(item) && (
                <ul className="app-sidebar-subnav">
                  {item.children.map((child) => (
                    <li key={child.label}>
                      <button
                        type="button"
                        className={["app-sidebar-sublink", child.to === location.pathname && "active"]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => goTo(child.to)}
                      >
                        {child.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
