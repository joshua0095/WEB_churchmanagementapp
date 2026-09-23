import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../api";
import { clearToken } from "../../auth";
import { InitialAvatar } from "../PeopleShared";
import IconButton from "./IconButton";
import { LogoutIcon, ProfileIcon } from "./icons";

type Me = { name: string; photoDataUrl: string | null };

// AppShell mounts a fresh ProfileMenu on every page (each page renders its own
// <AppShell headerRight={<ProfileMenu />}>), so without this module-level cache the avatar
// would reset to null and flash back to the generic icon on every navigation while it
// re-fetches. Caching outside the component lets a new mount show the last known photo
// immediately, then quietly revalidate in the background.
let cachedMe: Me | null = null;
const listeners = new Set<(me: Me | null) => void>();

/** Pushes a fresh name/photo into the shared cache and updates any ProfileMenu mounted right
 * now — e.g. Profile.tsx calls this right after a successful self-save, so the top bar picks
 * up a changed photo immediately instead of waiting for the next full page navigation (which
 * is the only other time a ProfileMenu re-fetches). */
export function setCachedMe(me: Me | null) {
  cachedMe = me;
  listeners.forEach((listener) => listener(me));
}

/** Profile button in the top bar; opens a small menu linking to the full Profile page
 * (your own details, editable) and sign-out. */
function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(cachedMe);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listeners.add(setMe);
    return () => {
      listeners.delete(setMe);
    };
  }, []);

  useEffect(() => {
    // Best-effort — the icon falls back to a generic glyph if this fails, so the top bar
    // still works fine even if it can't reach the API yet.
    getMe()
      .then(setCachedMe)
      .catch(() => {});
  }, []);

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
    <div className="profile-menu" ref={rootRef}>
      <IconButton
        className="profile-menu-trigger"
        aria-label="Profile"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {me ? <InitialAvatar name={me.name} photoUrl={me.photoDataUrl} size="md" /> : <ProfileIcon />}
      </IconButton>
      {open && (
        <div className="profile-menu-dropdown" role="menu">
          <button
            type="button"
            className="profile-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/profile");
            }}
          >
            <ProfileIcon />
            <span>My Profile</span>
          </button>
          <button type="button" className="profile-menu-item" role="menuitem" onClick={handleLogout}>
            <LogoutIcon />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileMenu;
