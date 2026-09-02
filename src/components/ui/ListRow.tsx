import { type ReactNode } from "react";

interface ListRowProps {
  primary: ReactNode;
  secondary?: ReactNode;
}

/** One row in a navy `.ui-list` — used for members and devotion entries. */
function ListRow({ primary, secondary }: ListRowProps) {
  return (
    <li className="ui-list-row">
      <span>{primary}</span>
      {secondary && <span className="ui-list-row-secondary">{secondary}</span>}
    </li>
  );
}

export default ListRow;
