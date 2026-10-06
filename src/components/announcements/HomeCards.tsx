import { CalendarIcon } from "../ui/icons";

/** "Sunday, 13 September 2026" */
export function formatLongDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${weekday}, ${rest}`;
}

/** "2026-09-13" → that calendar day at local midnight (new Date("2026-09-13") would be UTC,
 * which can land on the previous day). */
export function parseEventDate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Older announcements could have only an eyebrow line; it stands in as their title. */
export function announcementTitle(a: { title: string | null; eyebrow: string | null; imageDataUrl: string | null }): string | null {
  return a.title || (a.imageDataUrl ? null : a.eyebrow);
}

interface AnnouncementSlideProps {
  /** The day the announcement is for — no date line when it has none. */
  date: Date | null;
  title: string | null;
  content: string | null;
}

/** The text inside Home's announcement card — shared by the carousel and the "Preview on Home"
 * in the announcement modal, so the preview is exactly what members will see. */
export function AnnouncementSlide({ date, title, content }: AnnouncementSlideProps) {
  return (
    <>
      {title && <h2 className="home-announce-title">{title}</h2>}
      {content && <p className="home-announce-excerpt">{content}</p>}
      {date && (
        <p className="home-announce-date">
          <CalendarIcon aria-hidden="true" />
          <span>{formatLongDate(date)}</span>
        </p>
      )}
    </>
  );
}

/** An image announcement fills the whole card (behind the text, which then only shows on
 * hover/focus/tap — see .home-announce--image), so the card keeps the same size as a text one. */
export function AnnouncementCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="home-announce-cover">
      <img src={src} alt={alt} />
    </div>
  );
}

interface ThemeCardProps {
  /** "yyyy-MM" */
  monthLabel: string;
  imageSrc: string;
  alt: string;
  className?: string;
}

/** Home's theme-of-the-month card: the poster on top, a caption bar below. Also used as the
 * theme modal's "Preview on Home". */
export function ThemeCard({ monthLabel, imageSrc, alt, className }: ThemeCardProps) {
  return (
    <section className={["home-theme", className].filter(Boolean).join(" ")} aria-label="Theme of the month">
      <div className="home-theme-poster">
        <img src={imageSrc} alt={alt} decoding="async" />
      </div>
      <div className="home-theme-caption">
        <span className="home-theme-label">Theme of the month</span>
        <span className="home-theme-month">{monthLabel}</span>
      </div>
    </section>
  );
}
