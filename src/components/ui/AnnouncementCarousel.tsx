import { type ReactNode, useState } from "react";

export interface AnnouncementItem {
  eyebrow: string;
  title: ReactNode;
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
      <div className="announce-eyebrow">{item.eyebrow}</div>
      <h3 className="announce-title">{item.title}</h3>
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
