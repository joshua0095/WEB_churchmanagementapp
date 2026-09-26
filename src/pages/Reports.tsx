import { useNavigate } from "react-router-dom";
import { isAdmin, isMis } from "../auth";
import { AppShell, Card, ProfileMenu } from "../components/ui";
import { DevotionIcon, LifeGroupIcon, ReportsIcon } from "../components/ui/icons";

function Reports() {
  const navigate = useNavigate();
  const overseer = isAdmin() || isMis();

  if (!overseer) {
    return (
      <AppShell headerRight={<ProfileMenu />}>
        <div className="page-header">
          <h1>Reports</h1>
        </div>
        <p className="helper-text">You don't have access to Reports.</p>
      </AppShell>
    );
  }

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <p className="helper-text mb-6">Choose which report to view.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate("/reports/congregation")}
          className="cursor-pointer border-0 bg-transparent p-0 text-left"
        >
          <Card className="flex items-center gap-3 !p-5">
            <ReportsIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
            <span className="font-display text-lg font-bold text-[var(--color-navy)]">Congregation</span>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate("/reports/lifegroups")}
          className="cursor-pointer border-0 bg-transparent p-0 text-left"
        >
          <Card className="flex items-center gap-3 !p-5">
            <LifeGroupIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
            <span className="font-display text-lg font-bold text-[var(--color-navy)]">Life Groups</span>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => navigate("/reports/devotions")}
          className="cursor-pointer border-0 bg-transparent p-0 text-left"
        >
          <Card className="flex items-center gap-3 !p-5">
            <DevotionIcon className="h-6 w-6 shrink-0 text-[var(--color-navy)]" />
            <span className="font-display text-lg font-bold text-[var(--color-navy)]">Devotions</span>
          </Card>
        </button>
      </div>
    </AppShell>
  );
}

export default Reports;
