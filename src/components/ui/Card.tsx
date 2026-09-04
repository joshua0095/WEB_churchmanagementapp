import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

const CARD_CLASSES =
  "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] " +
  "p-6 shadow-[var(--shadow-card)]";

function Card({ children, className }: CardProps) {
  return (
    <section className={[CARD_CLASSES, className].filter(Boolean).join(" ")}>{children}</section>
  );
}

export default Card;
