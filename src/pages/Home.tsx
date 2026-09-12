import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAnnouncements, getMe, getVerseOfTheDay, type Announcement, type VerseOfTheDay } from "../api";
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
import { infoAlert } from "../swal";
import {
  AnnouncementsIcon,
  AttendanceIcon,
  DevotionIcon,
  HomeIcon,
  ReportsIcon,
  SettingsIcon,
  UserListIcon,
} from "../components/ui/icons";

function toAnnouncementItem(a: Announcement): AnnouncementItem {
  return { eyebrow: a.eyebrow, title: a.title, imageDataUrl: a.imageDataUrl };
}

/** Time-of-day greeting — swapped for "Welcome back" so the home screen reads as
 * someone actually greeting you, rather than a generic app login message. */
function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// A longer rotation of short, churchy lines — indexed by day-of-year (not day-of-week,
// since there are now more entries than weekdays) so it steps through all of them across
// the year instead of repeating a handful, while still staying fixed for the whole day
// (changing on every reload would feel like flicker/noise).
const DAILY_BLESSINGS = [
  "The Lord bless you and keep you today.",
  "Grace and peace to you this day.",
  "Walking in His presence today.",
  "May His joy be your strength today.",
  "Rejoice in the Lord always.",
  "His mercies are new this morning.",
  "Come, let us worship together today.",
  "Be still and know that He is God.",
  "The Lord is your shepherd today.",
  "His faithfulness endures forever.",
  "Cast your cares on Him today, for He cares for you.",
  "Trust in the Lord with all your heart today.",
  "The joy of the Lord is your strength.",
  "May His peace guard your heart today.",
  "Give thanks to the Lord, for He is good.",
  "Delight yourself in the Lord today.",
  "His grace is sufficient for you today.",
  "Let your light shine before others today.",
  "The Lord is near to the brokenhearted.",
  "Walk by faith, not by sight, today.",
  "His steadfast love never ceases.",
  "The Lord is your light and your salvation.",
  "He makes all things work together for good.",
  "Seek first His kingdom today.",
  "Nothing is impossible with God.",
  "The Lord fights for you; be still.",
  "His word is a lamp for your feet today.",
  "Be strong and courageous today.",
  "The Lord's hand is not too short to save.",
  "In His presence there is fullness of joy.",
  "He is able to do immeasurably more than you ask.",
  "The Lord is good to those who wait for Him.",
  "Great is His faithfulness this morning.",
  "Let everything you do be done in love.",
  "The name of the Lord is a strong tower.",
  "He restores your soul today.",
  "Wait on the Lord; be of good courage.",
  "His banner over you is love.",
  "The Lord will perfect what concerns you today.",
  "You are fearfully and wonderfully made.",
  "His plans for you are good, to give you hope.",
];

function blessingOfTheDay(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return DAILY_BLESSINGS[dayOfYear % DAILY_BLESSINGS.length];
}

function Home() {
  const navigate = useNavigate();

  const [verse, setVerse] = useState<VerseOfTheDay | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    getMe()
      .then((me) => setFirstName(me.firstName))
      .catch(() => {
        // The greeting just falls back to no name — nothing else on this page depends on it.
      });
  }, []);

  useEffect(() => {
    getVerseOfTheDay(getBibleVersionId("verseOfTheDay"))
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

  const comingSoon = (name: string) => () => void infoAlert(`${name} — coming soon`);

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="home">
        <div>
          <h1 className="welcome">
            {timeOfDayGreeting()}
            {firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="welcome-subtitle">{blessingOfTheDay()}</p>
        </div>

        <div className="home-highlights">
          <section>
            <h2 className="section-title">Announcements</h2>
            {announcementsLoading ? (
              <Skeleton className="aspect-video w-full rounded-lg" />
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
            <NavTile icon={<AttendanceIcon />} label="Attendance" onClick={() => navigate("/attendance")} />
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
