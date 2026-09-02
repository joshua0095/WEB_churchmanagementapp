import { type ReactNode } from "react";

interface NavTileProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

/** One tile in the home screen's navigation grid. */
function NavTile({ icon, label, onClick }: NavTileProps) {
  return (
    <button type="button" className="nav-tile" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default NavTile;
