import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  getAnnouncements,
  getAttendanceEvents,
  getBibleVersions,
  getDevotions,
  getMe,
  getVerseOfTheDay,
  type Announcement,
  type AttendanceEvent,
  type VerseOfTheDay,
} from "../api";
import { canAccessModule, isAdmin } from "../auth";
import { AnnouncementCarousel, AppShell, ProfileMenu, Skeleton } from "../components/ui";
import { ChurchIcon, NavAnnouncementsIcon, NavDevotionIcon } from "../components/ui/shellIcons";
import { monthlyTheme } from "../monthlyTheme";
import { getBibleVersionId } from "../preferences";
import sanctuaryPhoto from "../assets/login-bg.jpg";

/** Picked from the user's local time. */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "Saturday, 26 September" */
function formatBannerDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `${weekday}, ${rest}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Sunday 00:00 of the current week — the same week boundary the Devotion page uses. */
function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

/** Events aren't scheduled in the app — the only date we can work out is a Sunday-only
 * event's next Sunday (today, if it's Sunday). Returns null when there's no such event. */
function nextGathering(events: AttendanceEvent[]): string | null {
  const event = events.find((e) => e.sundayOnly);
  if (!event) return null;
  const today = new Date();
  if (today.getDay() === 0) return `Next: ${event.name} · Today`;
  const sunday = new Date(today);
  sunday.setDate(today.getDate() + (7 - today.getDay()));
  // "Sun 27 Sep" (en-GB's short month would give "Sept").
  const label = [
    sunday.toLocaleDateString("en-US", { weekday: "short" }),
    sunday.getDate(),
    sunday.toLocaleDateString("en-US", { month: "short" }),
  ].join(" ");
  return `Next: ${event.name} · ${label}`;
}

interface WalkCardProps {
  icon: ReactNode;
  title: string;
  status: ReactNode;
  action: { label: string; to: string; primary?: boolean };
}

function WalkCard({ icon, title, status, action }: WalkCardProps) {
  return (
    <article className="home-card home-walk-card">
      <div className="home-walk-head">
        <span className="home-walk-icon">{icon}</span>
        <div className="min-w-0">
          <h3 className="home-walk-card-title">{title}</h3>
          <div className="home-walk-status">{status}</div>
        </div>
      </div>
      <Link to={action.to} className={`home-btn ${action.primary ? "home-btn--gold" : "home-btn--outline"}`}>
        {action.label}
      </Link>
    </article>
  );
}

function Home() {
  const canAttendance = isAdmin() || canAccessModule("Attendance");
  const canAnnouncements = isAdmin() || canAccessModule("Announcements");
  const theme = monthlyTheme && monthlyTheme.title.trim() ? monthlyTheme : null;

  const [firstName, setFirstName] = useState("");
  const [verse, setVerse] = useState<VerseOfTheDay | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [versionLabel, setVersionLabel] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  // null = still loading; "unknown" = the fetch failed, so the card just offers the Devotion page.
  const [wroteToday, setWroteToday] = useState<boolean | "unknown" | null>(null);
  const [gathering, setGathering] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => setFirstName(me.firstName))
      .catch(() => {
        // The greeting just falls back to no name — nothing else on this page depends on it.
      });
  }, []);

  useEffect(() => {
    const versionId = getBibleVersionId("verseOfTheDay");
    getVerseOfTheDay(versionId)
      .then(setVerse)
      .catch((err) => setVerseError(err instanceof Error ? err.message : "Failed to load verse"))
      .finally(() => setVerseLoading(false));
    // The verse endpoint doesn't say which translation it used, so the label is only shown
    // when the user has picked one in Settings (otherwise it's the server's default).
    if (versionId) {
      getBibleVersions()
        .then((versions) => setVersionLabel(versions.find((v) => v.id === versionId)?.abbreviation ?? null))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    getAnnouncements()
      .then(setAnnouncements)
      .catch((err) => setAnnouncementsError(err instanceof Error ? err.message : "Failed to load announcements"))
      .finally(() => setAnnouncementsLoading(false));
  }, []);

  useEffect(() => {
    getDevotions()
      .then((devos) => setWroteToday(devos.some((d) => isSameDay(new Date(d.date), new Date()))))
      .catch(() => setWroteToday("unknown"));
  }, []);

  useEffect(() => {
    if (!canAttendance) return;
    getAttendanceEvents()
      .then((events) => setGathering(nextGathering(events)))
      .catch(() => {});
  }, [canAttendance]);

  const weekStart = startOfWeek(new Date());
  const announcementsThisWeek = announcements.filter((a) => new Date(a.createdAt) >= weekStart).length;
  const walkCount = 1 + (canAttendance ? 1 : 0) + (canAnnouncements ? 1 : 0);

  return (
    <AppShell headerRight={<ProfileMenu />} pageClassName="page--home">
      <div className="home">
        {/* 1. Welcome banner */}
        <section className="home-hero" aria-labelledby="home-greeting">
          <span className="home-ribbon" aria-hidden="true" />
          <div className="home-hero-media">
            <img src={sanctuaryPhoto} alt="The Jesus Is Lord Norzagaray sanctuary" decoding="async" />
            <div className="home-hero-media-overlay" aria-hidden="true" />
          </div>
          <div className="home-hero-text">
            <p className="home-hero-date">{formatBannerDate(new Date())}</p>
            <h1 id="home-greeting" className="home-hero-title">
              {timeOfDayGreeting()}
              {firstName ? `, ${firstName}` : ""}.
              <br />
              <span className="home-hero-title-sub">God bless your day.</span>
            </h1>
            {verseLoading ? (
              <div className="home-verse" aria-hidden="true">
                <Skeleton className="mb-2 h-5 w-full opacity-20" />
                <Skeleton className="mb-3 h-5 w-4/5 opacity-20" />
                <Skeleton className="h-3.5 w-40 opacity-20" />
              </div>
            ) : verse ? (
              <figure className="home-verse">
                <blockquote className="home-verse-text">“{verse.text}”</blockquote>
                <figcaption className="home-verse-cite">
                  <span className="home-verse-ref">{verse.reference}</span>
                  {" · Verse of the day"}
                  {versionLabel ? ` · ${versionLabel}` : ""}
                </figcaption>
              </figure>
            ) : (
              <p className="home-verse-error">{verseError ?? "The verse of the day isn't available right now."}</p>
            )}
          </div>
        </section>

        {/* 2. Announcements + theme of the month */}
        <div className={theme ? "home-row" : "home-row home-row--single"}>
          {announcementsLoading ? (
            <div className="home-card home-announce" aria-hidden="true">
              <Skeleton className="mb-5 h-3 w-40" />
              <Skeleton className="mb-3 h-4 w-52" />
              <Skeleton className="mb-3 h-8 w-3/4" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : announcements.length > 0 ? (
            <AnnouncementCarousel items={announcements} showViewAll={canAnnouncements} />
          ) : (
            <section className="home-card home-announce" aria-label="Church announcements">
              <p className="home-eyebrow">Church announcements</p>
              <p className="helper-text mt-3">{announcementsError ?? "No announcements yet."}</p>
            </section>
          )}

          {theme && (
            <section className="home-theme" aria-label="Theme of the month">
              <p className="home-theme-label">{theme.month} · Theme of the month</p>
              <p className="home-theme-keyword">{theme.keyword}</p>
              <h2 className="home-theme-title">{theme.title}</h2>
              <span className="home-theme-divider" aria-hidden="true" />
              <p className="home-theme-verses">{theme.verses.join(" · ")}</p>
            </section>
          )}
        </div>

        {/* 3. Your walk today */}
        <section aria-labelledby="home-walk-title">
          <h2 id="home-walk-title" className="home-walk-title">
            Your walk today
          </h2>
          <div className={`home-walk-grid home-walk-grid--${walkCount}`}>
            <WalkCard
              icon={<NavDevotionIcon />}
              title="Time in the Word"
              status={
                wroteToday === null ? (
                  <Skeleton className="mt-1 h-3.5 w-44" />
                ) : wroteToday === "unknown" ? (
                  "Spend a few minutes in the Word today"
                ) : wroteToday ? (
                  "You wrote today's devotion ✓"
                ) : (
                  "Today's devotion isn't written yet"
                )
              }
              action={
                wroteToday === "unknown"
                  ? { label: "Open devotions", to: "/devotion", primary: true }
                  : wroteToday
                    ? { label: "View today's devotion", to: "/devotion?open=today" }
                    : { label: "Write today's devotion", to: "/devotion?compose=today", primary: true }
              }
            />
            {canAttendance && (
              <WalkCard
                icon={<ChurchIcon />}
                title="Gather with the church"
                status={gathering ?? "Take attendance for today's service"}
                action={{ label: "Take attendance", to: "/attendance" }}
              />
            )}
            {canAnnouncements && (
              <WalkCard
                icon={<NavAnnouncementsIcon />}
                title="Share with the church"
                status={
                  announcementsLoading ? (
                    <Skeleton className="mt-1 h-3.5 w-40" />
                  ) : (
                    `${announcementsThisWeek} announcement${announcementsThisWeek === 1 ? "" : "s"} this week`
                  )
                }
                action={{ label: "Post an announcement", to: "/announcements" }}
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default Home;
