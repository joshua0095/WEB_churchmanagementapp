import { useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import type { Announcement } from "../../api";
import { AnnouncementCover, AnnouncementSlide, announcementTitle, formatLongDate, parseEventDate } from "../announcements/HomeCards";
import { CalendarIcon } from "./icons";
import { Modal } from "../dialogs";
import { NavChevronIcon } from "./shellIcons";

interface AnnouncementCarouselProps {
  items: Announcement[];
  /** Shows the "View all" link to the Announcements page (only for users who can open it). */
  showViewAll?: boolean;
}

/** Minimum horizontal travel (px) before a touch counts as a swipe rather than a tap/scroll. */
const SWIPE_THRESHOLD = 40;

/** Home's announcements card: one announcement at a time with dots, prev/next and swipe,
 * and a "Read more" dialog for the full text and image. */
function AnnouncementCarousel({ items, showViewAll = false }: AnnouncementCarouselProps) {
  const [index, setIndex] = useState(0);
  const [readingId, setReadingId] = useState<number | null>(null);
  // Image slides hide their text until hover/focus; on touch screens a tap reveals it instead.
  const [revealed, setRevealed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (items.length === 0) return null;
  const item = items[Math.min(index, items.length - 1)];
  const hasMany = items.length > 1;
  const reading = items.find((a) => a.id === readingId) ?? null;

  const prev = () => {
    setIndex((i) => (i - 1 + items.length) % items.length);
    setRevealed(false);
  };
  const next = () => {
    setIndex((i) => (i + 1) % items.length);
    setRevealed(false);
  };

  // React bubbles events out of portals along the component tree, so taps and swipes inside
  // the (portaled) Read more dialog would reach the card's handlers too — ignore those.
  const fromCard = (e: { currentTarget: Element; target: EventTarget }) => e.currentTarget.contains(e.target as Node);

  const onTouchStart = (e: TouchEvent) => {
    if (!fromCard(e)) return;
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !hasMany) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Mostly-vertical movement is the page scrolling, not a swipe.
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) next();
    else prev();
  };

  const imageSrc = item.imageDataUrl;
  const toggleDetails = (e: MouseEvent) => {
    if (!imageSrc || !fromCard(e) || (e.target as HTMLElement).closest("a, button")) return;
    setRevealed((r) => !r);
  };

  return (
    <section
      className={[
        "home-card home-announce",
        imageSrc && "home-announce--image",
        imageSrc && revealed && "home-announce--revealed",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Church announcements"
      onClick={toggleDetails}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {imageSrc && <AnnouncementCover src={imageSrc} alt={announcementTitle(item) ?? "Church announcement"} />}
      <div className="home-announce-head">
        <p className="home-eyebrow">Church announcements</p>
        {showViewAll && (
          <Link to="/announcements" className="home-link">
            View all
          </Link>
        )}
      </div>

      <div className="home-announce-body">
        <AnnouncementSlide date={parseEventDate(item.eventDate)} title={announcementTitle(item)} content={item.content} />
      </div>

      <div className="home-announce-foot">
        <button type="button" className="home-btn home-btn--outline home-btn--sm" onClick={() => setReadingId(item.id)}>
          Read more
        </button>
        {hasMany && (
          <>
            <div className="home-dots" aria-hidden="true">
              {items.map((a, i) => (
                <span key={a.id} className={i === index ? "home-dot home-dot--active" : "home-dot"} />
              ))}
            </div>
            <p className="sr-only" aria-live="polite">
              Announcement {index + 1} of {items.length}
            </p>
            <div className="home-announce-nav">
              <button type="button" className="home-round-btn" onClick={prev} aria-label="Previous announcement">
                <NavChevronIcon className="rotate-90" />
              </button>
              <button
                type="button"
                className="home-round-btn home-round-btn--solid"
                onClick={next}
                aria-label="Next announcement"
              >
                <NavChevronIcon className="-rotate-90" />
              </button>
            </div>
          </>
        )}
      </div>

      <Modal open={reading !== null} onClose={() => setReadingId(null)} title={(reading && announcementTitle(reading)) || "Announcement"}>
        {reading && (
          <div className="flex flex-col gap-3">
            {reading.content && <p className="m-0 whitespace-pre-line leading-relaxed">{reading.content}</p>}
            {reading.eventDate && (
              <p className="home-announce-date">
                <CalendarIcon aria-hidden="true" />
                <span>{formatLongDate(parseEventDate(reading.eventDate)!)}</span>
              </p>
            )}
            {/* Title, details and date only — the image is already the card itself, so it's only
                shown here for an image-only announcement that has nothing else to read. */}
            {!reading.content && !announcementTitle(reading) && reading.imageDataUrl && (
              <img src={reading.imageDataUrl} alt="" className="block w-full rounded-lg" />
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}

export default AnnouncementCarousel;
