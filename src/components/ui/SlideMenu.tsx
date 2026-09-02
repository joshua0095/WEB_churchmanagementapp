export interface SlideMenuItem {
  label: string;
  onClick: () => void;
}

interface SlideMenuProps {
  open: boolean;
  onClose: () => void;
  items: SlideMenuItem[];
}

/** Full-screen dimmed overlay with a right-side navigation panel. */
function SlideMenu({ open, onClose, items }: SlideMenuProps) {
  return (
    <div
      className={["menu-overlay", open && "menu-overlay--open"].filter(Boolean).join(" ")}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-hidden={!open}
    >
      <nav className="menu-panel">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default SlideMenu;
