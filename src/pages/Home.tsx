import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AnnouncementCarousel,
  AppHeader,
  IconButton,
  NavTile,
  SlideMenu,
  VerseCard,
  type SlideMenuItem,
} from "../components/ui";
import {
  AnnouncementsIcon,
  DevotionIcon,
  HomeIcon,
  MenuIcon,
  ProfileIcon,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const comingSoon = (name: string) => () => window.alert(`${name} — coming soon`);

  const menuItems: SlideMenuItem[] = [
    { label: "Home", onClick: () => navigate("/") },
    { label: "Devotion", onClick: () => navigate("/devotion") },
    { label: "Reports", onClick: comingSoon("Reports") },
    { label: "Announcements", onClick: comingSoon("Announcements") },
    { label: "User List", onClick: () => navigate("/members") },
    { label: "Settings", onClick: comingSoon("Settings") },
  ];

  return (
    <>
      <AppHeader
        left={
          <IconButton aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </IconButton>
        }
        right={
          <IconButton aria-label="Profile">
            <ProfileIcon />
          </IconButton>
        }
      />

      <div className="page">
        <h1 className="welcome">Welcome back!</h1>

        <h2 className="section-title">Announcements</h2>
        <AnnouncementCarousel items={ANNOUNCEMENTS} />

        <h2 className="section-title">Verse of the Day</h2>
        <VerseCard
          reference="Philippians 3:17"
          text="Join with others in following my example, brothers, and take note of those who live according to the pattern we gave you."
        />

        <h2 className="section-title">Menu</h2>
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
          <NavTile icon={<SettingsIcon />} label="Settings" onClick={comingSoon("Settings")} />
        </div>
      </div>

      <SlideMenu open={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
    </>
  );
}

export default Home;
