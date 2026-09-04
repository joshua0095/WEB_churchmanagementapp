import { type ReactNode, useState } from "react";

export interface AnnouncementItem {
  eyebrow?: string | null;
  title?: ReactNode;
  imageDataUrl?: string | null;
}

interface AnnouncementCarouselProps {
  items: AnnouncementItem[];
}

function AnnouncementCarousel({ items }: AnnouncementCarouselProps) {
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;
  const item = items[index];
  const showArrows = items.length > 1;

  return (
    <div className="announce-card">
      {showArrows && (
        <button
          type="button"
          className="carousel-arrow carousel-arrow--left"
          onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
          aria-label="Previous announcement"
        >
          ‹
        </button>
      )}
      {item.imageDataUrl && (
        <img className="announce-image" src={item.imageDataUrl} alt="" />
      )}
      {(item.eyebrow || item.title) && (
        <div className={`announce-body${item.imageDataUrl ? " announce-body--overlay" : ""}`}>
          {item.eyebrow && <div className="announce-eyebrow">{item.eyebrow}</div>}
          {item.title && <h3 className="announce-title">{item.title}</h3>}
        </div>
      )}
      {showArrows && (
        <button
          type="button"
          className="carousel-arrow carousel-arrow--right"
          onClick={() => setIndex((i) => (i + 1) % items.length)}
          aria-label="Next announcement"
        >
          ›
        </button>
      )}
    </div>
  );
}

export default AnnouncementCarousel;
