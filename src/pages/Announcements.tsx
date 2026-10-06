import { useCallback, useEffect, useState } from "react";
import {
  deleteAnnouncement,
  getAnnouncements,
  getMonthlyThemes,
  monthlyThemeImageSrc,
  sendAnnouncement,
  type Announcement,
  type MonthlyThemeInfo,
  type MonthlyThemeOverview,
} from "../api";
import { isAdmin } from "../auth";
import AnnouncementModal from "../components/announcements/AnnouncementModal";
import { announcementTitle, formatLongDate, parseEventDate } from "../components/announcements/HomeCards";
import { ImageIcon, PencilIcon, PlusIcon, SendIcon, TrashLineIcon, UploadIcon } from "../components/announcements/icons";
import MonthlyThemeModal from "../components/announcements/MonthlyThemeModal";
import { useConfirm, useToast } from "../components/dialogs";
import { AppShell, DropdownMenu, ProfileMenu, Skeleton } from "../components/ui";
import { CheckThinIcon, KebabIcon } from "../components/ui/shellIcons";
import { formatThemeMonth, manilaMonth, monthName, themeAltText } from "../monthlyTheme";

/** "13 Sep 2026" (en-GB's short month would give "Sept"). */
function formatShortDate(d: Date): string {
  return `${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })} ${d.getFullYear()}`;
}

interface ThemeSlotProps {
  month: string;
  theme: MonthlyThemeInfo | null;
  isCurrent: boolean;
  onOpen: (month: string) => void;
}

/** One month in the "Monthly theme" row: the poster if it's set, otherwise a dashed prompt to upload it. */
function ThemeSlot({ month, theme, isCurrent, onOpen }: ThemeSlotProps) {
  const label = formatThemeMonth(month);
  const name = monthName(month);

  if (theme) {
    return (
      <article className="ann-theme-card">
        <div className="ann-theme-poster">
          <img src={monthlyThemeImageSrc(theme)} alt={themeAltText(month, theme.name)} decoding="async" />
          <span className="ann-chip ann-chip--gold ann-theme-chip">{isCurrent ? "Showing now" : "Scheduled"}</span>
        </div>
        <div className="ann-theme-foot">
          <div className="min-w-0">
            <p className="ann-theme-month">{label}</p>
            {theme.name && <p className="ann-theme-name">{theme.name}</p>}
          </div>
          <button type="button" className="ann-btn ann-btn--outline ann-btn--sm" onClick={() => onOpen(month)}>
            Replace image
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="ann-theme-card ann-theme-card--empty">
      <span className={`ann-chip ${isCurrent ? "ann-chip--danger" : "ann-chip--soft"}`}>
        <span className="ann-chip-dot" aria-hidden="true" />
        {isCurrent ? "Missing" : "Not set yet"}
      </span>
      <h3 className="ann-theme-empty-title">{label}</h3>
      <p className="ann-theme-empty-text">
        {isCurrent
          ? "Home isn't showing a theme card this month. Upload the poster and it shows right away."
          : `Upload the ${name} poster and it switches on Home on 1 ${name}. If nothing is set, Home hides the theme card.`}
      </p>
      <button type="button" className="ann-btn ann-btn--gold" onClick={() => onOpen(month)}>
        <UploadIcon />
        Upload {name} poster
      </button>
    </article>
  );
}

interface AnnouncementCardProps {
  announcement: Announcement;
  canSend: boolean;
  sending: boolean;
  onSend: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** "Mon 14 Sep" */
function formatDayShort(d: Date): string {
  return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
}

function AnnouncementCard({ announcement: a, canSend, sending, onSend, onEdit, onDelete }: AnnouncementCardProps) {
  const posted = new Date(a.createdAt);
  const title = announcementTitle(a);
  const eventDate = parseEventDate(a.eventDate);
  // Kept through the day after its date (the server deletes it after that).
  const lastDay = eventDate && new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate() + 1);
  return (
    <article className="ann-card">
      {a.imageDataUrl ? (
        <div className="ann-card-preview ann-card-preview--image">
          <img src={a.imageDataUrl} alt={title ?? ""} />
          {!title && (
            <span className="ann-image-tag">
              <ImageIcon />
              Image only
            </span>
          )}
        </div>
      ) : (
        <div className="ann-card-preview ann-card-preview--text">
          <span className="ann-card-ribbon" aria-hidden="true" />
          <div className="ann-card-preview-text">
            {eventDate && <p className="ann-card-preview-date">{formatLongDate(eventDate)}</p>}
            <p className="ann-card-preview-title">{title || "Announcement"}</p>
          </div>
        </div>
      )}

      <div className="ann-card-body">
        <h3 className={title ? "ann-card-title" : "ann-card-title ann-card-title--none"}>
          {title || (a.imageDataUrl ? "Image announcement (no title)" : "Untitled announcement")}
        </h3>
        <p className="ann-card-meta">
          Posted {formatShortDate(posted)}
          {lastDay && ` · On Home until ${formatDayShort(lastDay)}`}
        </p>
        {a.sentAt ? (
          <span className="ann-chip ann-chip--success">
            <CheckThinIcon strokeWidth={2.6} />
            Sent to members
          </span>
        ) : (
          <span className="ann-chip ann-chip--soft">
            <span className="ann-chip-dot" aria-hidden="true" />
            Not sent yet
          </span>
        )}
      </div>

      <div className="ann-card-foot">
        {canSend && (
          <button
            type="button"
            className={`ann-btn ann-btn--grow ${a.sentAt ? "ann-btn--outline" : "ann-btn--gold"}`}
            onClick={onSend}
            disabled={sending}
          >
            <SendIcon />
            {sending ? "Sending…" : a.sentAt ? "Send again" : "Send to members"}
          </button>
        )}
        <DropdownMenu
          ariaLabel={`More actions for ${a.title || "this announcement"}`}
          icon={<KebabIcon />}
          triggerClassName="ann-kebab"
          items={[
            { label: "Edit", icon: <PencilIcon />, onSelect: onEdit },
            { label: "Delete", icon: <TrashLineIcon />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
    </article>
  );
}

function Announcements() {
  const toast = useToast();
  const confirm = useConfirm();
  const canSend = isAdmin(); // the send endpoint is admin-only

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; editing: Announcement | null }>({ open: false, editing: null });

  const [themes, setThemes] = useState<MonthlyThemeOverview | null>(null);
  const [themesError, setThemesError] = useState<string | null>(null);
  const [themeModal, setThemeModal] = useState<{ open: boolean; month: string }>({ open: false, month: manilaMonth() });

  const loadAnnouncements = useCallback(async () => {
    setError(null);
    try {
      setAnnouncements(await getAnnouncements());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThemes = useCallback(async () => {
    setThemesError(null);
    try {
      setThemes(await getMonthlyThemes());
    } catch (err) {
      setThemesError(err instanceof Error ? err.message : "Failed to load the monthly theme");
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
    loadThemes();
  }, [loadAnnouncements, loadThemes]);

  const handleSend = async (a: Announcement) => {
    const ok = await confirm({
      title: a.sentAt ? "Send it again?" : "Send to members?",
      description: "This emails every member. It can't be undone.",
      confirmLabel: a.sentAt ? "Send again" : "Send",
      danger: false,
      icon: <SendIcon />,
    });
    if (!ok) return;

    setSendingId(a.id);
    try {
      const { sentCount, sentAt } = await sendAnnouncement(a.id);
      if (sentCount === 0) {
        toast.show({ type: "error", title: "Couldn't send it", message: "No emails went out. Please try again later." });
        return;
      }
      setAnnouncements((list) => list.map((x) => (x.id === a.id ? { ...x, sentAt } : x)));
      toast.show({ type: "success", title: "Sent to members", message: `Emailed ${sentCount} member${sentCount === 1 ? "" : "s"}.` });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't send it", message: err instanceof Error ? err.message : undefined });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (a: Announcement) => {
    const ok = await confirm({
      title: "Delete this announcement?",
      description: "It's removed from everyone's Home screen. This can't be undone.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteAnnouncement(a.id);
      setAnnouncements((list) => list.filter((x) => x.id !== a.id));
      toast.show({ type: "success", title: "Announcement deleted" });
    } catch (err) {
      toast.show({ type: "error", title: "Couldn't delete it", message: err instanceof Error ? err.message : undefined });
    }
  };

  const openNew = () => setEditor({ open: true, editing: null });
  const openTheme = (month: string) => setThemeModal({ open: true, month });
  const count = announcements.length;

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="ann-page">
        <div className="ann-header">
          <div>
            <h1 className="ann-title">Announcements</h1>
            <p className="ann-subtitle">The monthly theme poster and announcements show on everyone's Home screen.</p>
          </div>
          <button type="button" className="ann-btn ann-btn--gold ann-new-btn" onClick={openNew}>
            <PlusIcon />
            <span className="ann-new-long">New announcement</span>
            <span className="ann-new-short" aria-hidden="true">
              New
            </span>
          </button>
        </div>

        <section aria-labelledby="ann-theme-heading">
          <div className="ann-section-head">
            <h2 id="ann-theme-heading" className="ann-section-title">
              Monthly theme
            </h2>
            <span className="ann-section-note">
              <span className="ann-section-note-long">The poster shows on Home for the whole month</span>
              <span className="ann-section-note-short">On Home all month</span>
            </span>
          </div>
          {themesError ? (
            <p className="error">{themesError}</p>
          ) : !themes ? (
            <div className="ann-theme-grid" aria-hidden="true">
              <Skeleton className="aspect-video w-full rounded-[16px]" />
              <Skeleton className="h-full min-h-48 w-full rounded-[16px]" />
            </div>
          ) : (
            <div className="ann-theme-grid">
              <ThemeSlot month={themes.currentMonth} theme={themes.current} isCurrent onOpen={openTheme} />
              <ThemeSlot month={themes.nextMonth} theme={themes.next} isCurrent={false} onOpen={openTheme} />
            </div>
          )}
        </section>

        <section aria-labelledby="ann-list-heading">
          <div className="ann-section-head">
            <h2 id="ann-list-heading" className="ann-section-title">
              <span className="ann-section-note-long">Announcements on Home</span>
              <span className="ann-section-note-short">Announcements</span>
            </h2>
            {!loading && !error && (
              <span className="ann-section-note">
                {count} announcement{count === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {error ? (
            <p className="error">{error}</p>
          ) : loading ? (
            <div className="ann-grid" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-80 w-full rounded-[16px]" />
              ))}
            </div>
          ) : (
            <div className="ann-grid">
              {announcements.map((a) => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  canSend={canSend}
                  sending={sendingId === a.id}
                  onSend={() => handleSend(a)}
                  onEdit={() => setEditor({ open: true, editing: a })}
                  onDelete={() => handleDelete(a)}
                />
              ))}
              <button type="button" className="ann-new-tile" onClick={openNew}>
                <span className="ann-new-tile-icon" aria-hidden="true">
                  <PlusIcon />
                </span>
                <span className="ann-new-tile-title">New announcement</span>
                <span className="ann-new-tile-hint">Add text, an image, or both</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <AnnouncementModal
        open={editor.open}
        editing={editor.editing}
        canSend={canSend}
        onClose={() => setEditor((s) => ({ ...s, open: false }))}
        onSaved={loadAnnouncements}
      />
      <MonthlyThemeModal
        open={themeModal.open}
        currentMonth={themes?.currentMonth ?? manilaMonth()}
        initialMonth={themeModal.month}
        onClose={() => setThemeModal((s) => ({ ...s, open: false }))}
        onSaved={loadThemes}
      />
    </AppShell>
  );
}

export default Announcements;
