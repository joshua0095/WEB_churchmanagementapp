interface VerseCardProps {
  reference: string;
  text: string;
}

function VerseCard({ reference, text }: VerseCardProps) {
  return (
    <div className="verse-card">
      <div className="verse-ref">{reference}</div>
      <p>{text}</p>
    </div>
  );
}

export default VerseCard;
