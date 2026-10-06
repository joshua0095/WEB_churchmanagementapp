import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { LifeGroupCategory } from "../../api";
import { CheckThinIcon, NavChevronIcon } from "../ui/shellIcons";

export interface LifeGroupPickerOption {
  id: number;
  groupName: string;
  category: LifeGroupCategory;
  /** Null when the person picking is the leader themselves (their own groups). */
  leaderName: string | null;
}

interface LifeGroupPickerProps {
  groups: LifeGroupPickerOption[];
  value: number | null;
  onChange: (id: number) => void;
}

/** Past this many groups the list gets a search box. */
const SEARCH_THRESHOLD = 6;

function categoryLabel(category: LifeGroupCategory) {
  return category === "Community" ? "Community" : "Church";
}

function leaderLabel(g: LifeGroupPickerOption) {
  return g.leaderName ?? "You";
}

/** The attendance setup's Life Group dropdown. Closed, it's a 44px button that sits in line
 * with Continue / + Add Life Group; open, each group shows its leader and Church/Community
 * type (which a native <select> can't lay out). Keyboard: ↑/↓ to move, Enter to pick, Esc
 * to close. */
function LifeGroupPicker({ groups, value, onChange }: LifeGroupPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = groups.find((g) => g.id === value) ?? null;
  const showSearch = groups.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const visible = q
    ? groups.filter((g) => g.groupName.toLowerCase().includes(q) || leaderLabel(g).toLowerCase().includes(q))
    : groups;

  const openList = () => {
    setQuery("");
    setActive(Math.max(0, groups.findIndex((g) => g.id === value)));
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (id: number) => {
    onChange(id);
    close();
  };

  // Focus the search (or the list) on open; close on a click outside.
  useEffect(() => {
    if (!open) return;
    (showSearch ? searchRef.current : listRef.current)?.focus();
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, showSearch]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onListKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const g = visible[active];
      if (g) pick(g.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  const activeId = visible[active] ? `${listId}-${visible[active].id}` : undefined;

  return (
    <div className="lg-picker" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={["lg-picker-trigger", open && "lg-picker-trigger--open"].filter(Boolean).join(" ")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={selected ? `Life Group: ${selected.groupName}, led by ${leaderLabel(selected)}` : "Choose a life group"}
        onClick={() => (open ? close() : openList())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            openList();
          }
        }}
      >
        {selected ? (
          <span className="lg-picker-value">
            <span className="lg-picker-name">{selected.groupName}</span>
            <span className="lg-picker-leader">· {leaderLabel(selected)}</span>
          </span>
        ) : (
          <span className="lg-picker-placeholder">Choose a life group…</span>
        )}
        <NavChevronIcon className="lg-picker-chevron" />
      </button>

      {open && (
        <div className="lg-picker-pop">
          {showSearch && (
            <input
              ref={searchRef}
              className="lg-picker-search"
              type="search"
              placeholder="Search group or leader"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onListKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-label="Search life groups"
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            className="lg-picker-list"
            aria-label="Life groups"
            tabIndex={showSearch ? -1 : 0}
            aria-activedescendant={showSearch ? undefined : activeId}
            onKeyDown={showSearch ? undefined : onListKeyDown}
          >
            {visible.length === 0 && <li className="lg-picker-empty">No life groups match “{query.trim()}”.</li>}
            {visible.map((g, i) => {
              const isSelected = g.id === value;
              return (
                <li
                  key={g.id}
                  id={`${listId}-${g.id}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    "lg-picker-option",
                    i === active && "lg-picker-option--active",
                    isSelected && "lg-picker-option--selected",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(g.id)}
                >
                  <span className="lg-picker-option-text">
                    <span className="lg-picker-option-name">{g.groupName}</span>
                    <span className="lg-picker-option-leader">Leader: {leaderLabel(g)}</span>
                  </span>
                  <span className={`lg-picker-chip lg-picker-chip--${g.category === "Community" ? "community" : "church"}`}>
                    {categoryLabel(g.category)}
                  </span>
                  <span className="lg-picker-check" aria-hidden="true">
                    {isSelected && <CheckThinIcon strokeWidth={2.6} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default LifeGroupPicker;
