import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getVerseOfTheDay, type VerseOfTheDay } from "../api";
import { AnnouncementCarousel, AppShell, NavTile, ProfileMenu, VerseCard } from "../components/ui";
import { getBibleVersionId } from "../preferences";
import {
  AnnouncementsIcon,
  DevotionIcon,
  HomeIcon,
  ReportsIcon,
  SettingsIcon,
  UserListIcon,
} from "../components/ui/icons";

const ANNOUNCEMENTS = [
  {
    eyebrow: "REVIVAL: A CALL TO",
    title: (
      <>
        ABSOLUTE
        <br />
        OBEDIENCE
      </>
    ),
  },
];

function Home() {
  const navigate = useNavigate();

  const [verse, setVerse] = useState<VerseOfTheDay | null>(null);
  const [verseError, setVerseError] = useState<string | null>(null);

  useEffect(() => {
    getVerseOfTheDay(getBibleVersionId())
      .then(setVerse)
      .catch((err) => setVerseError(err instanceof Error ? err.message : "Failed to load verse"));
  }, []);

  const comingSoon = (name: string) => () => window.alert(`${name} — coming soon`);

  return (
    <AppShell headerRight={<ProfileMenu />}>
      <div className="home">
        <h1 className="welcome">Welcome back!</h1>

        <div className="home-highlights">
          <section>
            <h2 className="section-title">Announcements</h2>
            <AnnouncementCarousel items={ANNOUNCEMENTS} />
          </section>

          <section>
            <h2 className="section-title">Verse of the Day</h2>
            {verse ? (
              <VerseCard reference={verse.reference} text={verse.text} />
            ) : (
              <p className="helper-text">{verseError ?? "Loading verse..."}</p>
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
              onClick={comingSoon("Announcements")}
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
