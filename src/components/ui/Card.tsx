import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

function Card({ children, className }: CardProps) {
  return (
    <section className={["ui-card", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export default Card;
