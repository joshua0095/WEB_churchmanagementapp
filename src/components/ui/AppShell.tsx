import { type ReactNode, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { canAccessModule, clearToken, getRoleLabel } from "../../auth";
import { useMe, setCachedMe } from "../../meCache";
import { getSidebarCollapsed, setSidebarCollapsed } from "../../preferences";
import { InitialAvatar } from "../PeopleShared";
import {
  CollapseSidebarIcon,
  MoreNavIcon,
  NavAnnouncementsIcon,
  NavAttendanceIcon,
  NavChevronIcon,
  NavDevotionIcon,
  NavHomeIcon,
  NavPeopleIcon,
  NavReportsIcon,
  NavSettingsIcon,
  ShellLogOutIcon,
} from "./shellIcons";
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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Home", icon: <NavHomeIcon />, to: "/" }] },
  {
    label: "Ministry",
    items: [
      { label: "Devotion", icon: <NavDevotionIcon />, to: "/devotion" },
      { label: "Attendance", icon: <NavAttendanceIcon />, to: "/attendance", module: "Attendance" },
      { label: "Announcements", icon: <NavAnnouncementsIcon />, to: "/announcements", module: "Announcements" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Reports", icon: <NavReportsIcon />, to: "/reports", module: "Reports" },
      {
        label: "People",
        icon: <NavPeopleIcon />,
        module: "People",
        children: [
          { label: "Workers", to: "/people/workers" },
          { label: "Congregation", to: "/people/congregation" },
        ],
      },
      { label: "Settings", icon: <NavSettingsIcon />, to: "/settings" },
    ],
  },
];

const MOBILE_TABS: (NavItem & { mobileLabel?: string })[] = [
  { label: "Home", icon: <NavHomeIcon />, to: "/" },
  { label: "Devotion", icon: <NavDevotionIcon />, to: "/devotion" },
  { label: "Attendance", icon: <NavAttendanceIcon />, to: "/attendance", module: "Attendance" },
  { label: "Reports", icon: <NavReportsIcon />, to: "/reports", module: "Reports" },
];

const BREADCRUMBS: Record<string, { section: string; title: string }> = {
  "/": { section: "Overview", title: "Home" },
  "/devotion": { section: "Ministry", title: "Devotion" },
  "/attendance": { section: "Ministry", title: "Attendance" },
  "/attendance/workers": { section: "Ministry", title: "Attendance" },
  "/attendance/congregation": { section: "Ministry", title: "Attendance" },
  "/attendance/headcount": { section: "Ministry", title: "Attendance" },
  "/attendance/lifegroups": { section: "Ministry", title: "Attendance" },
  "/announcements": { section: "Ministry", title: "Announcements" },
  "/reports": { section: "Admin", title: "Reports" },
  "/reports/congregation": { section: "Admin", title: "Reports" },
  "/reports/lifegroups": { section: "Admin", title: "Reports" },
  "/reports/devotions": { section: "Admin", title: "Reports" },
  "/people": { section: "Admin", title: "People" },
  "/people/workers": { section: "Admin", title: "Workers" },
  "/people/congregation": { section: "Admin", title: "Congregation" },
  "/settings": { section: "Admin", title: "Settings" },
  "/settings/general": { section: "Admin", title: "Settings" },
  "/settings/attendance": { section: "Admin", title: "Settings" },
  "/settings/lifegroups": { section: "Admin", title: "Settings" },
  "/settings/networks": { section: "Admin", title: "Settings" },
  "/settings/access": { section: "Admin", title: "Settings" },
  "/profile": { section: "Account", title: "My Profile" },
};

interface AppShellProps {
  children: ReactNode;
  headerRight?: ReactNode;
  /** Extra class on the page content wrapper, for a page that needs its own width/padding
   * (e.g. Home's full-bleed mobile banner). */
  pageClassName?: string;
}

/** Authenticated app layout: a persistent (collapsible) sidebar + top bar on desktop
 * (≥1024px), collapsing to a navy top bar + fixed bottom tab bar with a "More" sheet
 * on mobile. */
function AppShell({ children, headerRight, pageClassName }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);
  const [manualExpanded, setManualExpanded] = useState<Record<string, boolean>>({});
  const [moreOpen, setMoreOpen] = useState(false);
  // Keeps the sheet mounted while its slide-down exit animation plays; it unmounts on animationend.
  const [moreClosing, setMoreClosing] = useState(false);
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreClosing(true);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [moreOpen]);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      setSidebarCollapsed(next);
      return next;
    });
  };

  const isChildActive = (item: NavItem) => item.children?.some((c) => c.to === location.pathname) ?? false;
  // Prefix-matches sub-routes too (e.g. Settings' /settings/attendance, Attendance's
  // /attendance/workers) — safe for Home's "/" since no real path starts with "//".
  const isItemActive = (item: NavItem) =>
    item.to === location.pathname || (!!item.to && location.pathname.startsWith(`${item.to}/`)) || isChildActive(item);
  const isExpanded = (item: NavItem) => manualExpanded[item.label] ?? isChildActive(item);

  const canSeeItem = (item: NavItem) => !item.module || canAccessModule(item.module);

  const goTo = (to: string) => {
    navigate(to);
    setMoreOpen(false);
  };

  const handleItemClick = (item: NavItem) => {
    if (item.children) {
      if (collapsed) {
        goTo(item.children[0].to);
        return;
      }
      setManualExpanded((prev) => ({ ...prev, [item.label]: !isExpanded(item) }));
      return;
    }
    if (item.to) goTo(item.to);
  };

  const handleLogout = () => {
    clearToken();
    setCachedMe(null);
    setMoreOpen(false);
    navigate("/login", { replace: true });
  };

  const roleLabel = getRoleLabel();
  const breadcrumb = BREADCRUMBS[location.pathname];
  const visibleMobileTabs = MOBILE_TABS.filter(canSeeItem);
  const mobileTabLabels = new Set(MOBILE_TABS.map((t) => t.label));
  const moreItems = NAV_GROUPS.flatMap((g) => g.items).filter((i) => !mobileTabLabels.has(i.label) && canSeeItem(i));

  const goToItem = (item: NavItem) => {
    if (item.children) goTo(item.children[0].to);
    else if (item.to) goTo(item.to);
  };

  return (
    <div className="app-shell">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className={["app-sidebar", collapsed && "app-sidebar--collapsed"].filter(Boolean).join(" ")}>
        <div className="app-sidebar-brand">
          <Logo size={collapsed ? 32 : 44} className="app-sidebar-brand-logo" />
          {!collapsed && (
            <div className="app-sidebar-brand-text">
              <div className="app-sidebar-brand-name">JIL Norzagaray</div>
              <div className="app-sidebar-brand-tag">Connect</div>
            </div>
          )}
        </div>

        <nav aria-label="Main" className="app-sidebar-nav">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter(canSeeItem);
            if (items.length === 0) return null;
            return (
              <div key={group.label} className="app-nav-group">
                {!collapsed && <div className="app-nav-group-label">{group.label}</div>}
                {items.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <div key={item.label}>
                      {item.children ? (
                        <button
                          type="button"
                          className={["app-nav-link", active && "app-nav-link--active"].filter(Boolean).join(" ")}
                          aria-expanded={!collapsed && isExpanded(item)}
                          onClick={() => handleItemClick(item)}
                        >
                          {active && <span className="app-nav-ribbon" aria-hidden="true" />}
                          {item.icon}
                          {!collapsed && (
                            <>
                              <span className="app-nav-link-label">{item.label}</span>
                              <NavChevronIcon
                                className={["app-nav-chevron", isExpanded(item) && "app-nav-chevron--open"]
                                  .filter(Boolean)
                                  .join(" ")}
                              />
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={["app-nav-link", active && "app-nav-link--active"].filter(Boolean).join(" ")}
                          onClick={() => handleItemClick(item)}
                        >
                          {active && <span className="app-nav-ribbon" aria-hidden="true" />}
                          {item.icon}
                          {!collapsed && <span className="app-nav-link-label">{item.label}</span>}
                        </button>
                      )}
                      {item.children && !collapsed && isExpanded(item) && (
                        <div className="app-nav-subnav">
                          {item.children.map((child) => (
                            <button
                              key={child.label}
                              type="button"
                              className={[
                                "app-nav-sublink",
                                child.to === location.pathname && "app-nav-sublink--active",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onClick={() => goTo(child.to)}
                            >
                              {child.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className={["app-user-card", location.pathname === "/profile" && "app-user-card--active"].filter(Boolean).join(" ")}>
          {location.pathname === "/profile" && <span className="app-nav-ribbon app-nav-ribbon--card" aria-hidden="true" />}
          <button type="button" className="app-user-card-link" onClick={() => navigate("/profile")} aria-label="My profile">
            {me ? <InitialAvatar name={me.name} photoUrl={me.photoDataUrl} size="md" tone="gold" /> : <InitialAvatar name="?" tone="gold" />}
            {!collapsed && (
              <span className="app-user-card-info">
                <span className="app-user-card-name">{me?.name ?? "Loading..."}</span>
                <span className="app-user-card-role">{roleLabel}</span>
              </span>
            )}
          </button>
          {!collapsed && (
            <button type="button" className="app-user-card-logout" aria-label="Log out" onClick={handleLogout}>
              <ShellLogOutIcon />
            </button>
          )}
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="app-main">
        {/* Desktop top bar */}
        <header className="app-topbar app-topbar--desktop">
          <button
            type="button"
            className="app-topbar-iconbtn"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            <CollapseSidebarIcon />
          </button>
          {breadcrumb && (
            <div className="app-breadcrumb">
              <span className="app-breadcrumb-section">{breadcrumb.section}</span>
              <NavChevronIcon className="app-breadcrumb-chevron" />
              <span className="app-breadcrumb-title">{breadcrumb.title}</span>
            </div>
          )}
          <div className="flex-grow" />
          {headerRight}
        </header>

        {/* Mobile top bar */}
        <header className="app-topbar app-topbar--mobile">
          <Logo size={32} className="app-topbar-mobile-logo" />
          <div className="app-topbar-mobile-brand">
            <div className="app-topbar-mobile-name">JIL Norzagaray</div>
            <div className="app-topbar-mobile-tag">Connect</div>
          </div>
          {headerRight}
        </header>

        <div className={["page", pageClassName].filter(Boolean).join(" ")}>{children}</div>

        {/* Mobile bottom tab bar */}
        <nav aria-label="Main" className="app-bottom-nav" style={{ gridTemplateColumns: `repeat(${visibleMobileTabs.length + 1}, minmax(0, 1fr))` }}>
          {visibleMobileTabs.map((item) => {
            const active = item.to === location.pathname;
            return (
              <button
                key={item.label}
                type="button"
                className="app-bottom-tab"
                aria-current={active ? "page" : undefined}
                onClick={() => item.to && goTo(item.to)}
              >
                <span className={["app-bottom-tab-icon", active && "app-bottom-tab-icon--active"].filter(Boolean).join(" ")}>
                  {item.icon}
                </span>
                <span className={["app-bottom-tab-label", active && "app-bottom-tab-label--active"].filter(Boolean).join(" ")}>
                  {item.mobileLabel ?? item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="app-bottom-tab app-bottom-tab--more"
            aria-haspopup="dialog"
            aria-expanded={moreOpen && !moreClosing}
            aria-label={`More (${moreItems.length + 1} more pages)`}
            onClick={() => {
              setMoreClosing(false);
              setMoreOpen(true);
            }}
          >
            <span className="app-bottom-tab-icon app-bottom-tab-icon--more">
              <MoreNavIcon />
              {/* +1 for My Profile, which the sheet always lists. */}
              <span className="app-bottom-tab-badge" aria-hidden="true">
                {moreItems.length + 1}
              </span>
            </span>
            <span className="app-bottom-tab-label app-bottom-tab-label--more">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile "More" sheet */}
      {moreOpen && (
        <div className={`app-more-sheet-root${moreClosing ? " is-closing" : ""}`}>
          <div className="app-more-sheet-backdrop" onClick={() => setMoreClosing(true)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More"
            className="app-more-sheet"
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget || !moreClosing) return;
              setMoreOpen(false);
              setMoreClosing(false);
            }}
          >
            <div className="app-more-sheet-handle" aria-hidden="true" />
            {moreItems.map((item) => (
              <button key={item.label} type="button" className="app-more-sheet-item" onClick={() => goToItem(item)}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            <button type="button" className="app-more-sheet-item" onClick={() => goTo("/profile")}>
              {me ? <InitialAvatar name={me.name} photoUrl={me.photoDataUrl} size="xs" /> : <InitialAvatar name="?" />}
              <span>My Profile</span>
            </button>
            <div className="app-more-sheet-divider" />
            <button type="button" className="app-more-sheet-item app-more-sheet-item--danger" onClick={handleLogout}>
              <ShellLogOutIcon />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;
