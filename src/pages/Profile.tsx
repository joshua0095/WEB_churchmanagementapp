import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { clearToken } from "../auth";
import { EditableAvatar } from "../components/PeopleShared";
import { abbreviateNetworkName } from "../components/networkTree";
import { AppShell, Button, Card, ProfileMenu, Skeleton, TextField, setCachedMe } from "../components/ui";
import { ShellLogOutIcon, LockIcon } from "../components/ui/shellIcons";
import { successToast } from "../swal";

const emptyForm = { firstName: "", middleName: "", lastName: "", nickname: "", email: "", birthday: "" };
type ProfileForm = typeof emptyForm;

function formFromUser(user: User): ProfileForm {
  return {
    firstName: user.firstName,
    middleName: user.middleName ?? "",
    lastName: user.lastName,
    nickname: user.nickname ?? "",
    email: user.email,
    birthday: user.birthday ? user.birthday.slice(0, 10) : "",
  };
}

function byIds<T extends { id: number }>(ids: number[], all: T[]): T[] {
  return ids.map((id) => all.find((x) => x.id === id)).filter((x): x is T => !!x);
}

function roleLabel(user: User): string {
  if (user.isAdmin) return "Admin";
  if (user.isRegistrar) return "Registrar";
  return "Member";
}

function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState<User | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [myGroups, setMyGroups] = useState<LifeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
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
      setForm(formFromUser(meRes));
      setPhotoDataUrl(meRes.photoDataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myNetworks = useMemo(() => (me ? byIds(me.networkIds, networks) : []), [me, networks]);
  const myMinistries = useMemo(() => (me ? byIds(me.ministryIds, ministries) : []), [me, ministries]);

  const isDirty =
    !!me &&
    (JSON.stringify(form) !== JSON.stringify(formFromUser(me)) || photoDataUrl !== me.photoDataUrl);

  const handleDiscard = () => {
    if (!me) return;
    setForm(formFromUser(me));
    setPhotoDataUrl(me.photoDataUrl);
    setSaveError(null);
  };

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
        photoDataUrl,
      });
      setMe(updated);
      setForm(formFromUser(updated));
      setCachedMe({ name: updated.name, photoDataUrl: updated.photoDataUrl });
      successToast("Profile updated");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update your profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setCachedMe(null);
    navigate("/login", { replace: true });
  };

  return (
    <AppShell headerRight={<ProfileMenu />}>
      {loading ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        </div>
      ) : error ? (
        <p className="error">{error}</p>
      ) : me ? (
        <div className="flex flex-col gap-6">
          {/* Hero */}
          <Card className="!rounded-2xl !p-0 overflow-hidden">
            <div className="relative h-28 bg-[var(--color-navy)]">
              <span className="absolute right-12 top-0 h-14 w-[18px] bg-[var(--color-gold)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_80%,0_100%)]" />
            </div>
            <div className="flex flex-col items-start gap-4 px-6 pb-7 sm:-mt-12 sm:flex-row sm:items-end">
              <EditableAvatar name={me.name} photoUrl={photoDataUrl} onChange={setPhotoDataUrl} size="xl" tone="cream" serif />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1 sm:pt-17">
                <h1 className="m-0 font-display text-[1.7rem] font-semibold text-[var(--color-text-primary)]">{me.name}</h1>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm text-[var(--color-text-secondary)]">{me.email}</span>
                  {myNetworks.length > 0 && <span className="h-1 w-1 rounded-full bg-[var(--color-text-secondary)]" />}
                  <span className="profile-badge profile-badge--admin">{roleLabel(me)}</span>
                  {myNetworks.map((n) => (
                    <span key={n.id} className="profile-badge">
                      {abbreviateNetworkName(n.name)}
                    </span>
                  ))}
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => navigate("/forgot-password")} className="shrink-0">
                <LockIcon className="h-4 w-4" />
                Change password
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            {/* Personal details */}
            <Card className="!rounded-2xl !p-0 flex flex-col">
              <div className="flex flex-col gap-1 px-7 pb-1 pt-6">
                <h2 className="m-0 font-display text-xl font-semibold text-[var(--color-text-primary)]">Personal details</h2>
                <p className="m-0 text-sm text-[var(--color-text-secondary)]">
                  This is how you appear to your network and leaders.
                </p>
              </div>

              <div className="flex flex-col gap-3.5 px-7 py-5">
                <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  Name
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    className="ui-field--lg"
                    label="First name"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    required
                  />
                  <TextField
                    className="ui-field--lg"
                    label="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    required
                  />
                  <TextField
                    className="ui-field--lg"
                    label="Middle name (optional)"
                    value={form.middleName}
                    onChange={(e) => setForm((f) => ({ ...f, middleName: e.target.value }))}
                  />
                  <TextField
                    className="ui-field--lg"
                    label="Nickname (optional)"
                    placeholder="What people call you"
                    value={form.nickname}
                    onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mx-7 h-px bg-[var(--color-border)]" />

              <div className="flex flex-col gap-3.5 px-7 pb-6 pt-5">
                <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  Contact &amp; birthday
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    className="ui-field--lg"
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                  <TextField
                    className="ui-field--lg"
                    label="Birthday"
                    type="date"
                    value={form.birthday}
                    onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col items-stretch gap-3 rounded-b-2xl border-t border-[var(--color-border)] bg-[var(--color-bg)] px-7 py-4 sm:flex-row sm:items-center">
                <span className="flex-grow text-[0.8rem] text-[var(--color-text-secondary)]">
                  {saveError ?? "Changes are saved to your account."}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={handleDiscard} disabled={saving || !isDirty}>
                    Discard
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !isDirty || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Right column */}
            <div className="flex flex-col gap-6">
              <Card className="!rounded-2xl">
                <h2 className="m-0 mb-4 font-display text-lg font-semibold text-[var(--color-text-primary)]">Where you serve</h2>
                <div className="flex flex-col gap-2">
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                    Network{myNetworks.length === 1 ? "" : "s"}
                  </div>
                  {myNetworks.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {myNetworks.map((n) => (
                        <div key={n.id} className="flex items-center gap-3 rounded-xl bg-[var(--color-bg)] p-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-navy)] text-xs font-bold text-[var(--color-gold)]">
                            {abbreviateNetworkName(n.name)}
                          </div>
                          <div className="text-sm font-semibold leading-snug text-[var(--color-text-primary)]">{n.name}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-[1.5px] border-dashed border-[color-mix(in_srgb,var(--color-navy)_18%,transparent)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
                      Not part of a network yet
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                    Ministries
                  </div>
                  {myMinistries.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {myMinistries.map((m) => (
                        <div key={m.id} className="rounded-xl bg-[var(--color-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-primary)]">
                          {m.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border-[1.5px] border-dashed border-[color-mix(in_srgb,var(--color-navy)_18%,transparent)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
                      Not part of a ministry yet
                    </div>
                  )}
                </div>

                {myGroups.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                      Life {myGroups.length === 1 ? "Group" : "Groups"} led
                    </div>
                    <div className="flex flex-col gap-2">
                      {myGroups.map((g) => (
                        <div key={g.id} className="rounded-xl bg-[var(--color-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-primary)]">
                          {g.groupName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card className="!rounded-2xl flex flex-col gap-3.5">
                <h2 className="m-0 font-display text-lg font-semibold text-[var(--color-text-primary)]">Account</h2>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">Role</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{roleLabel(me)}</span>
                </div>
                <Button type="button" variant="outline" onClick={handleLogout} className="mt-1.5 w-full">
                  <ShellLogOutIcon className="h-4 w-4" />
                  Log out
                </Button>
              </Card>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default Profile;
