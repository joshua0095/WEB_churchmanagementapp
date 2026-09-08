import { useEffect, useState } from "react";
import {
  getBibleVersions,
  getModuleAccess,
  getNetworks,
  MODULES as ACCESS_MODULES,
  setModuleAccessRule,
  type BibleVersion,
  type ModuleAccessRow,
  type ModuleName,
  type Network,
} from "../api";
import { isAdmin } from "../auth";
import { AppShell, Card, Skeleton, SelectField } from "../components/ui";
import { getBibleVersionId, setBibleVersionId, type BibleModule } from "../preferences";

const BIBLE_MODULES: { key: BibleModule; label: string }[] = [
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

  const canManageAccess = isAdmin();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [accessRows, setAccessRows] = useState<ModuleAccessRow[]>([]);
  const [loadingAccess, setLoadingAccess] = useState(canManageAccess);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

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

  useEffect(() => {
    if (!canManageAccess) return;
    (async () => {
      setLoadingAccess(true);
      setAccessError(null);
      try {
        const [networkList, rows] = await Promise.all([getNetworks(), getModuleAccess()]);
        setNetworks(networkList);
        setAccessRows(rows);
      } catch (err) {
        setAccessError(err instanceof Error ? err.message : "Failed to load module access");
      } finally {
        setLoadingAccess(false);
      }
    })();
  }, [canManageAccess]);

  const handleChange = (module: BibleModule, id: string) => {
    setSelected((current) => ({ ...current, [module]: id }));
    setBibleVersionId(module, id);
  };

  const isAllowed = (networkId: number, module: ModuleName) =>
    accessRows.find((r) => r.networkId === networkId && r.module === module)?.isAllowed ?? true;

  const handleToggleAccess = async (networkId: number, module: ModuleName) => {
    const cellKey = `${networkId}-${module}`;
    const nextValue = !isAllowed(networkId, module);
    setSavingCell(cellKey);
    setAccessError(null);
    try {
      const updated = await setModuleAccessRule({ networkId, module, isAllowed: nextValue });
      setAccessRows((rows) => {
        const withoutThisCell = rows.filter((r) => !(r.networkId === networkId && r.module === module));
        return [...withoutThisCell, updated];
      });
    } catch (err) {
      setAccessError(err instanceof Error ? err.message : "Failed to update module access");
    } finally {
      setSavingCell(null);
    }
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
            {BIBLE_MODULES.map((mod) => (
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

      {canManageAccess && (
        <Card className="mt-6">
          <h2 className="section-title">Module Access by Network</h2>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Control which modules each network can use. Admins always have full access. A network with no
            explicit rule below defaults to allowed.
          </p>
          {loadingAccess && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {accessError && <p className="error mb-3">{accessError}</p>}
          {!loadingAccess && networks.length === 0 && (
            <p className="helper-text">No networks yet — add some from the People page first.</p>
          )}
          {!loadingAccess && networks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-[var(--color-border)] px-3 py-2 text-left font-bold text-[var(--color-text-secondary)]">
                      Network
                    </th>
                    {ACCESS_MODULES.map((mod) => (
                      <th
                        key={mod}
                        className="border-b border-[var(--color-border)] px-3 py-2 text-center font-bold text-[var(--color-text-secondary)]"
                      >
                        {mod}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {networks.map((n) => (
                    <tr key={n.id}>
                      <td className="border-b border-[var(--color-border)] px-3 py-2">
                        <p className="font-semibold text-[var(--color-text-primary)]">{n.name}</p>
                      </td>
                      {ACCESS_MODULES.map((mod) => {
                        const cellKey = `${n.id}-${mod}`;
                        return (
                          <td key={mod} className="border-b border-[var(--color-border)] px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isAllowed(n.id, mod)}
                              disabled={savingCell === cellKey}
                              onChange={() => handleToggleAccess(n.id, mod)}
                              aria-label={`${n.name} access to ${mod}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </AppShell>
  );
}

export default Settings;
