import { type ReactNode } from "react";

interface ListRowProps {
  primary: ReactNode;
  secondary?: ReactNode;
  actions?: ReactNode;
  thumbnail?: ReactNode;
}

/** One row in a navy `.ui-list` — used for members and devotion entries. */
function ListRow({ primary, secondary, actions, thumbnail }: ListRowProps) {
  return (
    <li className="ui-list-row">
      {thumbnail && <span className="ui-list-row-thumb">{thumbnail}</span>}
      <span>{primary}</span>
      {secondary && <span className="ui-list-row-secondary">{secondary}</span>}
      {actions && <span className="ui-list-row-actions">{actions}</span>}
    </li>
  );
}

export default ListRow;
