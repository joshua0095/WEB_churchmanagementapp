import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAnnouncements, getVerseOfTheDay, type Announcement, type VerseOfTheDay } from "../api";
import {
  AnnouncementCarousel,
  AppShell,
  NavTile,
  ProfileMenu,
  Skeleton,
  VerseCard,
  type AnnouncementItem,
} from "../components/ui";
import { getBibleVersionId } from "../preferences";
import {
  AnnouncementsIcon,
  DevotionIcon,
  HomeIcon,
  ReportsIcon,
  SettingsIcon,
  UserListIcon,
} from "../components/ui/icons";

function toAnnouncementItem(a: Announcement): AnnouncementItem {
  return { eyebrow: a.eyebrow, title: a.title, imageDataUrl: a.imageDataUrl };
}

function Home() {
  const navigate = useNavigate();

  const [verse, setVerse] = useState<VerseOfTheDay | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  useEffect(() => {
    getVerseOfTheDay(getBibleVersionId())
      .then(setVerse)
      .catch((err) => setVerseError(err instanceof Error ? err.message : "Failed to load verse"))
      .finally(() => setVerseLoading(false));
  }, []);

  useEffect(() => {
    getAnnouncements()
      .then((items) => setAnnouncements(items.map(toAnnouncementItem)))
      .catch((err) =>
        setAnnouncementsError(err instanceof Error ? err.message : "Failed to load announcements"),
      )
      .finally(() => setAnnouncementsLoading(false));
  }, []);

  const comingSoon = (name: string) => () => window.alert(`${name} — coming soon`);

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="home">
        <h1 className="welcome">Welcome back!</h1>

        <div className="home-highlights">
          <section>
            <h2 className="section-title">Announcements</h2>
            {announcementsLoading ? (
              <Skeleton className="aspect-video w-full rounded-[14px]" />
            ) : announcements.length > 0 ? (
              <AnnouncementCarousel items={announcements} />
            ) : (
              <p className="helper-text">{announcementsError ?? "No announcements yet."}</p>
            )}
          </section>

          <section>
            <h2 className="section-title">Verse of the Day</h2>
            {verseLoading ? (
              <div className="verse-card">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="mb-1 h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ) : verse ? (
              <VerseCard reference={verse.reference} text={verse.text} />
            ) : (
              <p className="helper-text">{verseError}</p>
            )}
          </section>
        </div>

        <section>
          <h2 className="section-title">Quick Links</h2>
          <div className="nav-grid">
            <NavTile icon={<HomeIcon />} label="Home" onClick={() => navigate("/")} />
            <NavTile icon={<DevotionIcon />} label="Devotion" onClick={() => navigate("/devotion")} />
            <NavTile icon={<ReportsIcon />} label="Reports" onClick={comingSoon("Reports")} />
            <NavTile
              icon={<AnnouncementsIcon />}
              label="Announcements"
              onClick={() => navigate("/announcements")}
            />
            <NavTile icon={<UserListIcon />} label="User List" onClick={() => navigate("/members")} />
            <NavTile icon={<SettingsIcon />} label="Settings" onClick={() => navigate("/settings")} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

export default Home;
