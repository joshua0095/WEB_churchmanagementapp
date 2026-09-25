import { useRef, useState, type TouchEvent } from "react";
import { Link } from "react-router-dom";
import type { Announcement } from "../../api";
import Modal from "./Modal";
import { CalendarIcon } from "./icons";
import { NavChevronIcon } from "./shellIcons";

interface AnnouncementCarouselProps {
  items: Announcement[];
  /** Shows the "View all" link to the Announcements page (only for users who can open it). */
  showViewAll?: boolean;
}

/** Minimum horizontal travel (px) before a touch counts as a swipe rather than a tap/scroll. */
const SWIPE_THRESHOLD = 40;

/** "Sunday, 13 September 2026" */
function formatLongDate(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const rest = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${weekday}, ${rest}`;
}

/** Home's announcements card: one announcement at a time with dots, prev/next and swipe,
 * and a "Read more" dialog for the full text and image. */
function AnnouncementCarousel({ items, showViewAll = false }: AnnouncementCarouselProps) {
  const [index, setIndex] = useState(0);
  const [readingId, setReadingId] = useState<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (items.length === 0) return null;
  const item = items[Math.min(index, items.length - 1)];
  const hasMany = items.length > 1;
  const reading = items.find((a) => a.id === readingId) ?? null;

  const prev = () => setIndex((i) => (i - 1 + items.length) % items.length);
  const next = () => setIndex((i) => (i + 1) % items.length);

  const onTouchStart = (e: TouchEvent) => {
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

  const title = item.title || item.eyebrow || "Announcement";

  return (
    <section className="home-card home-announce" aria-label="Church announcements">
      <div className="home-announce-head">
        <p className="home-eyebrow">Church announcements</p>
        {showViewAll && (
          <Link to="/announcements" className="home-link">
            View all
          </Link>
        )}
      </div>

      <div className="home-announce-body" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <p className="home-announce-date">
          <CalendarIcon aria-hidden="true" />
          <span>
            {formatLongDate(new Date(item.createdAt))}
            {item.title && item.eyebrow ? ` · ${item.eyebrow}` : ""}
          </span>
        </p>
        <h2 className="home-announce-title">{title}</h2>
        {item.content && <p className="home-announce-excerpt">{item.content}</p>}
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

      <Modal open={reading !== null} onClose={() => setReadingId(null)} title={reading?.title || reading?.eyebrow || "Announcement"}>
        {reading && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-[var(--color-text-secondary)]">
              {formatLongDate(new Date(reading.createdAt))}
              {reading.title && reading.eyebrow ? ` · ${reading.eyebrow}` : ""}
            </p>
            {reading.imageDataUrl && <img src={reading.imageDataUrl} alt="" className="block w-full rounded-lg" />}
            {reading.content && <p className="m-0 whitespace-pre-line leading-relaxed">{reading.content}</p>}
          </div>
        )}
      </Modal>
    </section>
  );
}

export default AnnouncementCarousel;
