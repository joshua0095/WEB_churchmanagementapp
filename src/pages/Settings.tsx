import { useEffect, useState } from "react";
import { getBibleVersions, type BibleVersion } from "../api";
import { AppShell, Card, SelectField, Skeleton } from "../components/ui";
import { getBibleVersionId, setBibleVersionId, type BibleModule } from "../preferences";

const MODULES: { key: BibleModule; label: string }[] = [
  { key: "verseOfTheDay", label: "Verse of the Day" },
  { key: "devotion", label: "Devotion" },
];

function Settings() {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selected, setSelected] = useState<Record<BibleModule, string>>({
    verseOfTheDay: getBibleVersionId("verseOfTheDay") ?? "",
    devotion: getBibleVersionId("devotion") ?? "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBibleVersions()
      .then((v) => {
        setVersions(v);
        setSelected((current) => ({
          verseOfTheDay: current.verseOfTheDay || v[0]?.id || "",
          devotion: current.devotion || v[0]?.id || "",
        }));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Bible versions"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (module: BibleModule, id: string) => {
    setSelected((current) => ({ ...current, [module]: id }));
    setBibleVersionId(module, id);
  };

  return (
    <AppShell>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <Card>
        <h2 className="section-title">Bible Version</h2>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Choose a translation for each module — they can be set independently.
        </p>
        {loading && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <div className="flex flex-col gap-4">
            {MODULES.map((mod) => (
              <SelectField
                key={mod.key}
                label={mod.label}
                value={selected[mod.key]}
                onChange={(e) => handleChange(mod.key, e.target.value)}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.abbreviation})
                  </option>
                ))}
              </SelectField>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}

export default Settings;
