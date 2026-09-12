interface TabItem<Key extends string> {
  key: Key;
  label: string;
}

interface TabsProps<Key extends string> {
  items: TabItem<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  className?: string;
}

/** Segmented-control tab strip — switches which section of a page is shown, rather than
 * navigating away (e.g. Settings' General/Attendance/Life Groups/... sections). The active
 * tab reads as a raised card (same surface/border/shadow language as the page's Cards),
 * floating inside a recessed track, rather than a plain underline. */
function Tabs<Key extends string>({ items, activeKey, onChange, className }: TabsProps<Key>) {
  return (
    <div
      role="tablist"
      className={[
        "inline-flex max-w-full gap-1 overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-1",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === activeKey}
          onClick={() => onChange(item.key)}
          className={[
            "shrink-0 whitespace-nowrap rounded-sm px-4 py-2 text-sm font-bold outline-none transition-all duration-150",
            item.key === activeKey
              ? "bg-[var(--color-surface)] text-[var(--color-navy)] shadow-[var(--shadow-card)]"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-navy)]",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
