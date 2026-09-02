import { useEffect, useState } from "react";
import { getBibleVersions, type BibleVersion } from "../api";
import { AppShell, Card, SelectField } from "../components/ui";
import { getBibleVersionId, setBibleVersionId } from "../preferences";

function Settings() {
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selected, setSelected] = useState(getBibleVersionId() ?? "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBibleVersions()
      .then((v) => {
        setVersions(v);
        setSelected((current) => current || v[0]?.id || "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Bible versions"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (id: string) => {
    setSelected(id);
    setBibleVersionId(id);
  };

  return (
    <AppShell>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <Card>
        <h2 className="section-title">Verse of the Day</h2>
        {loading && <p className="helper-text">Loading Bible versions...</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && (
          <SelectField
            label="Bible translation"
            value={selected}
            onChange={(e) => handleChange(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title} ({v.abbreviation})
              </option>
            ))}
          </SelectField>
        )}
      </Card>
    </AppShell>
  );
}

export default Settings;
