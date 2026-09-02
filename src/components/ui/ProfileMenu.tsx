import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../../auth";
import IconButton from "./IconButton";
import { LogoutIcon, ProfileIcon } from "./icons";

/** Profile button in the top bar; opens a small menu with sign-out. */
function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    navigate("/login", { replace: true });
  };

  return (
    <div className="profile-menu" ref={rootRef}>
      <IconButton aria-label="Profile" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <ProfileIcon />
      </IconButton>
      {open && (
        <div className="profile-menu-dropdown" role="menu">
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
