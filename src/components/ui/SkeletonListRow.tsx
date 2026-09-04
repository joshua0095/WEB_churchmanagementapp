import Skeleton from "./Skeleton";

interface SkeletonListRowProps {
  /** Reserve space for a `ListRow` thumbnail (see `ui-list-row-thumb`). */
  withThumbnail?: boolean;
}

/** Placeholder for a `ListRow` while its data is still loading. */
function SkeletonListRow({ withThumbnail }: SkeletonListRowProps) {
  return (
    <li className="flex items-center gap-4 p-3">
      {withThumbnail && <Skeleton className="aspect-video w-14 shrink-0" />}
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
    </li>
  );
}

export default SkeletonListRow;
