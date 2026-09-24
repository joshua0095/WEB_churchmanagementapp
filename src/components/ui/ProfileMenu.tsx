import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getRoleLabel } from "../../auth";
import { setCachedMe, useMe } from "../../meCache";
import { InitialAvatar } from "../PeopleShared";
import { ProfileIcon } from "./icons";
import { NavChevronIcon, NavSettingsIcon, ShellLogOutIcon } from "./shellIcons";

/** Account control in the top bar: a rich avatar/name/role button with a dropdown on
 * desktop, collapsing to a bare avatar that jumps straight to /profile on mobile (where
 * Settings/Log out already live in the bottom nav's "More" sheet). */
function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const me = useMe();
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const roleLabel = getRoleLabel();

  useEffect(() => {
    if (!open) return;
    const onClickAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, [open]);

  const handleLogout = () => {
    clearToken();
    setCachedMe(null);
    navigate("/login", { replace: true });
  };

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {me ? <InitialAvatar name={me.name} photoUrl={me.photoDataUrl} size="sm" /> : <ProfileIcon />}
        <span className="account-menu-info">
          <span className="account-menu-name">{me?.name ?? "Account"}</span>
          <span className="account-menu-role">{roleLabel}</span>
        </span>
        <NavChevronIcon className="account-menu-chevron" />
      </button>

      <button
        type="button"
        className="account-menu-mobile-trigger"
        aria-label="My profile"
        onClick={() => navigate("/profile")}
      >
        {me ? <InitialAvatar name={me.name} photoUrl={me.photoDataUrl} size="sm" /> : <ProfileIcon />}
      </button>

      {open && (
        <div className="account-menu-dropdown" role="menu">
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
          >
            <InitialAvatar name={me?.name ?? "?"} photoUrl={me?.photoDataUrl ?? null} size="xs" />
            <span>My Profile</span>
          </button>
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
          >
            <NavSettingsIcon />
            <span>Settings</span>
          </button>
          <div className="account-menu-divider" />
          <button
            type="button"
            className="account-menu-item account-menu-item--danger"
            role="menuitem"
            onClick={handleLogout}
          >
            <ShellLogOutIcon />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;
