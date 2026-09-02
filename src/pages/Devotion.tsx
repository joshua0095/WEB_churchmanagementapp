import { useMemo, useState } from "react";
import { AppShell, ListRow } from "../components/ui";
import { SearchIcon, TrashIcon } from "../components/ui/icons";

interface Devo {
  id: number;
  date: string;
  verse: string;
}

let nextDevoId = 1;

function makeSampleDevos(): Devo[] {
  return Array.from({ length: 9 }).map(() => ({
    id: nextDevoId++,
    date: "March 12, 2024",
    verse: "Psalms 34:13",
  }));
}

function Devotion() {
  const [devos, setDevos] = useState<Devo[]>(makeSampleDevos);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devos;
    return devos.filter(
      (d) => d.date.toLowerCase().includes(q) || d.verse.toLowerCase().includes(q),
    );
  }, [devos, query]);

  const handleAdd = () => {
    const today = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setDevos((prev) => [{ id: nextDevoId++, date: today, verse: "New entry" }, ...prev]);
  };

  const handleClear = () => {
    if (window.confirm("Clear all devotion entries?")) {
      setDevos([]);
    }
  };

  return (
    <AppShell headerRight={<span className="avatar">U</span>}>
      <div className="devo-page">
        <div className="devo-header">
          <h1>Add Your Devo For Today</h1>
          <button type="button" className="add-btn" onClick={handleAdd} aria-label="Add devotion">
            +
          </button>
          <hr className="divider" />
        </div>

        <div className="search-row">
          <input
            type="text"
            placeholder="Search devotions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search devotions"
          />
          <button type="button" className="icon-search" aria-label="Search">
            <SearchIcon />
          </button>
          <button type="button" className="icon-delete" onClick={handleClear} aria-label="Clear all">
            <TrashIcon />
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="helper-text">No devotions yet.</p>
        ) : (
          <ul className="ui-list">
            {filtered.map((d) => (
              <ListRow key={d.id} primary={d.date} secondary={d.verse} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

export default Devotion;
