import { type ComponentPropsWithoutRef } from "react";

type CardProps = ComponentPropsWithoutRef<"section">;

const CARD_CLASSES =
  "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md " +
  "p-6 shadow-[var(--shadow-card)]";

function Card({ children, className, ...rest }: CardProps) {
  return (
    <section className={[CARD_CLASSES, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </section>
  );
}

export default Card;
