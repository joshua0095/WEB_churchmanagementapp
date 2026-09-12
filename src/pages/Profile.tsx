import { useEffect, useState } from "react";
import {
  getMe,
  getMinistries,
  getMyLifeGroups,
  getNetworks,
  updateMe,
  type LifeGroup,
  type Ministry,
  type Network,
  type User,
} from "../api";
import { InitialAvatar } from "../components/PeopleShared";
import { AppShell, Button, Card, ProfileMenu, Skeleton, TextField } from "../components/ui";
import { successToast } from "../swal";

const emptyForm = { firstName: "", middleName: "", lastName: "", nickname: "", email: "", birthday: "" };

function namesById<T extends { id: number; name: string }>(ids: number[], all: T[]): string[] {
  return ids.map((id) => all.find((x) => x.id === id)?.name).filter((n): n is string => !!n);
}

function Profile() {
  const [me, setMe] = useState<User | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [myGroups, setMyGroups] = useState<LifeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, networkList, ministryList, groups] = await Promise.all([
        getMe(),
        getNetworks(),
        getMinistries(),
        getMyLifeGroups(),
      ]);
      setMe(meRes);
      setNetworks(networkList);
      setMinistries(ministryList);
      setMyGroups(groups);
      setForm({
        firstName: meRes.firstName,
        middleName: meRes.middleName ?? "",
        lastName: meRes.lastName,
        nickname: meRes.nickname ?? "",
        email: meRes.email,
        birthday: meRes.birthday ? meRes.birthday.slice(0, 10) : "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const networkNames = me ? namesById(me.networkIds, networks) : [];
  const ministryNames = me ? namesById(me.ministryIds, ministries) : [];

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateMe({
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || null,
        lastName: form.lastName.trim(),
        nickname: form.nickname.trim() || null,
        email: form.email.trim(),
        birthday: form.birthday || null,
      });
      setMe(updated);
      successToast("Profile updated");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update your profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="page-header">
        <h1>My Profile</h1>
      </div>

      {loading ? (
        <div className="page-sections">
          <Skeleton className="h-40 w-full rounded-md" />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-64 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : me ? (
        <div className="page-sections">
          <Card>
            <div className="profile-header">
              <InitialAvatar name={me.name} />
              <div>
                <p className="profile-name">{me.name}</p>
                <p className="profile-email">{me.email}</p>
              </div>
            </div>
            <div className="profile-badges">
              {me.isAdmin && <span className="profile-badge profile-badge--admin">Admin</span>}
              {me.isRegistrar && <span className="profile-badge">Registrar</span>}
              {!me.isAdmin && !me.isRegistrar && <span className="profile-badge">Member</span>}
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card>
              <h2 className="section-title" style={{ marginBottom: "5px" }}>Edit Profile</h2>
              <div className="flex flex-col gap-4 sm:max-w-sm">
                <TextField
                  label="First name"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
                <TextField
                  label="Middle name (optional)"
                  value={form.middleName}
                  onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))}
                />
                <TextField
                  label="Last name"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
                <TextField
                  label="Nickname (optional)"
                  value={form.nickname}
                  onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
                <TextField
                  label="Birthday"
                  type="date"
                  value={form.birthday}
                  onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                />
                {saveError && <p className="error">{saveError}</p>}
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                  className="self-start"
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </Card>

            <Card>
              <h2 className="section-title" style={{ marginBottom: "5px" }}>Networks &amp; Ministries</h2>
              <dl className="profile-details">
                <div>
                  <dt>Networks</dt>
                  <dd>{networkNames.length > 0 ? networkNames.join(", ") : "None"}</dd>
                </div>
                <div>
                  <dt>Ministries</dt>
                  <dd>{ministryNames.length > 0 ? ministryNames.join(", ") : "None"}</dd>
                </div>
                {myGroups.length > 0 && (
                  <div>
                    <dt>Life {myGroups.length === 1 ? "Group" : "Groups"} led</dt>
                    <dd>{myGroups.map((g) => g.groupName).join(", ")}</dd>
                  </div>
                )}
              </dl>
            </Card>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default Profile;
