import { useMemo, useState } from "react";
import type { Ministry, Network } from "../../api";
import { useConfirm } from "../dialogs";
import { getAncestorNetworkIds, SINGLE_SELECT_PARENT_NAME, type NetworkTreeNode } from "../networkTree";
import { CheckThinIcon, NavChevronIcon } from "../ui/shellIcons";
import { chipLabel } from "./PeopleChips";

export interface Assignments {
  networkIds: number[];
  ministryIds: number[];
}

interface NetworkAssignmentsProps {
  tree: NetworkTreeNode[];
  networks: Network[];
  ministries: Ministry[];
  value: Assignments;
  onChange: (next: Assignments) => void;
}

/** Picks a worker's networks and ministries: an "Assigned" row of removable chips, then one
 * collapsible card per top-level network with its sub-networks and ministries as toggle chips.
 *
 * Rules (same as the old checkbox tree, plus removal):
 * - Picking a ministry or sub-network also picks every network above it (e.g. VIA → WAN → MDN).
 * - Life Group Network's sub-networks are pick-one (a member is in exactly one demographic group).
 * - Removing a network also removes everything under it — confirmed first when that's more
 *   than one other thing. */
function NetworkAssignments({ tree, networks, ministries, value, onChange }: NetworkAssignmentsProps) {
  const confirm = useConfirm();

  const index = useMemo(() => {
    const byId = new Map(networks.map((n) => [n.id, n]));
    const children = new Map<number, number[]>();
    for (const n of networks) {
      if (n.parentNetworkId == null) continue;
      children.set(n.parentNetworkId, [...(children.get(n.parentNetworkId) ?? []), n.id]);
    }
    const descendants = (id: number): number[] => {
      const out: number[] = [];
      const walk = (nid: number) => {
        for (const c of children.get(nid) ?? []) {
          out.push(c);
          walk(c);
        }
      };
      walk(id);
      return out;
    };
    const singleSelectSiblings = (id: number): number[] | null => {
      const parentId = byId.get(id)?.parentNetworkId;
      if (parentId == null || byId.get(parentId)?.name !== SINGLE_SELECT_PARENT_NAME) return null;
      return (children.get(parentId) ?? []).filter((c) => c !== id);
    };
    return { byId, descendants, singleSelectSiblings };
  }, [networks]);

  const ministryById = useMemo(() => new Map(ministries.map((m) => [m.id, m])), [ministries]);

  // What removing a network takes with it: its sub-networks and every ministry in any of them.
  const removalOf = (id: number, from: Assignments) => {
    const netIds = new Set([id, ...index.descendants(id)]);
    return {
      networkIds: from.networkIds.filter((n) => !netIds.has(n)),
      ministryIds: from.ministryIds.filter((m) => !netIds.has(ministryById.get(m)?.networkId ?? -1)),
    };
  };

  const withNetwork = (id: number, from: Assignments): Assignments => {
    let next = from;
    // Pick-one groups: choosing one drops whichever sibling was chosen before.
    for (const sibling of index.singleSelectSiblings(id) ?? []) {
      if (next.networkIds.includes(sibling)) next = removalOf(sibling, next);
    }
    const add = [id, ...getAncestorNetworkIds(id, networks)].filter((n) => !next.networkIds.includes(n));
    return { ...next, networkIds: [...next.networkIds, ...add] };
  };

  const removeNetwork = async (id: number) => {
    const next = removalOf(id, value);
    const alsoRemoved = value.networkIds.length - next.networkIds.length - 1 + (value.ministryIds.length - next.ministryIds.length);
    if (alsoRemoved > 1) {
      const name = index.byId.get(id)?.name ?? "this network";
      const ok = await confirm({
        title: `Remove ${name}?`,
        description: `This also removes the ${alsoRemoved} teams and ministries under it.`,
        confirmLabel: "Remove",
      });
      if (!ok) return;
    }
    onChange(next);
  };

  const toggleNetwork = (id: number) => {
    if (value.networkIds.includes(id)) void removeNetwork(id);
    else onChange(withNetwork(id, value));
  };

  const toggleMinistry = (id: number) => {
    if (value.ministryIds.includes(id)) {
      onChange({ ...value, ministryIds: value.ministryIds.filter((m) => m !== id) });
      return;
    }
    const ministry = ministryById.get(id);
    const next = { ...value, ministryIds: [...value.ministryIds, id] };
    onChange(ministry ? withNetwork(ministry.networkId, next) : next);
  };

  // Everything assigned, in tree order (network, its ministries, then its sub-networks).
  const assigned = useMemo(() => {
    const out: { kind: "network" | "ministry"; id: number; name: string }[] = [];
    const walk = (nodes: NetworkTreeNode[]) => {
      for (const node of nodes) {
        if (value.networkIds.includes(node.network.id)) out.push({ kind: "network", id: node.network.id, name: node.network.name });
        for (const m of node.ministries) if (value.ministryIds.includes(m.id)) out.push({ kind: "ministry", id: m.id, name: m.name });
        walk(node.children);
      }
    };
    walk(tree);
    return out;
  }, [tree, value]);

  // Open the networks that already have something picked; the rest start collapsed.
  const [expanded, setExpanded] = useState<Set<number>>(
    () =>
      new Set(
        tree
          .filter((root) => [root.network.id, ...index.descendants(root.network.id)].some((id) => value.networkIds.includes(id)))
          .map((root) => root.network.id),
      ),
  );
  const toggleExpanded = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="wk-assign">
      <div>
        <p className="wk-assign-label">Assigned</p>
        {assigned.length === 0 ? (
          <p className="wk-assign-empty">Not assigned yet. Pick networks and ministries below.</p>
        ) : (
          <div className="wk-assigned">
            {assigned.map((a) => (
              <span key={`${a.kind}-${a.id}`} className={`wk-assigned-chip wk-chip--${a.kind}`}>
                {a.name}
                <button
                  type="button"
                  className="wk-assigned-remove"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => (a.kind === "network" ? void removeNetwork(a.id) : toggleMinistry(a.id))}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="wk-net-list">
        {tree.map((root) => (
          <NetworkCard
            key={root.network.id}
            root={root}
            value={value}
            descendants={index.descendants(root.network.id)}
            expanded={expanded.has(root.network.id)}
            onToggleExpanded={() => toggleExpanded(root.network.id)}
            onToggleNetwork={toggleNetwork}
            onToggleMinistry={toggleMinistry}
          />
        ))}
      </div>
    </div>
  );
}

interface NetworkCardProps {
  root: NetworkTreeNode;
  value: Assignments;
  descendants: number[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleNetwork: (id: number) => void;
  onToggleMinistry: (id: number) => void;
}

function ToggleChip({ label, title, on, onClick }: { label: string; title?: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="wk-toggle" aria-pressed={on} title={title} onClick={onClick}>
      {on && <CheckThinIcon strokeWidth={2.6} />}
      {label}
    </button>
  );
}

function NetworkCard({ root, value, descendants, expanded, onToggleExpanded, onToggleNetwork, onToggleMinistry }: NetworkCardProps) {
  const id = root.network.id;
  const selected = value.networkIds.includes(id);
  const isPickOne = root.network.name === SINGLE_SELECT_PARENT_NAME;
  const hasContent = root.ministries.length > 0 || root.children.length > 0;

  // Every sub-network below the root, depth-first, each with its own ministries.
  const sections: NetworkTreeNode[] = [];
  const walk = (nodes: NetworkTreeNode[]) => {
    for (const n of nodes) {
      sections.push(n);
      walk(n.children);
    }
  };
  walk(root.children);

  const selectedCount =
    descendants.filter((d) => value.networkIds.includes(d)).length +
    value.ministryIds.filter((m) => sections.concat(root).some((n) => n.ministries.some((x) => x.id === m))).length;
  const status = !hasContent ? "No ministries" : selectedCount > 0 ? `${selectedCount} selected` : "None selected";
  const bodyId = `wk-net-${id}`;

  return (
    <div className={["wk-net", selected && "wk-net--selected"].filter(Boolean).join(" ")}>
      <div className="wk-net-head">
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={root.network.name}
          className="wk-check-hit"
          onClick={() => onToggleNetwork(id)}
        >
          <span className="wk-check" aria-hidden="true">
            {selected && <CheckThinIcon strokeWidth={3} />}
          </span>
        </button>
        <button
          type="button"
          className="wk-net-title"
          onClick={hasContent ? onToggleExpanded : () => onToggleNetwork(id)}
          aria-expanded={hasContent ? expanded : undefined}
          aria-controls={hasContent ? bodyId : undefined}
        >
          <span className="wk-net-text">
            <span className="wk-net-name">{root.network.name}</span>
            <span className={selectedCount > 0 ? "wk-net-status wk-net-status--on" : "wk-net-status"}>{status}</span>
          </span>
          {hasContent && <NavChevronIcon className={expanded ? "wk-net-chevron wk-net-chevron--open" : "wk-net-chevron"} />}
        </button>
      </div>

      {hasContent && expanded && (
        <div className="wk-net-body" id={bodyId}>
          {root.ministries.length > 0 && (
            <div className="wk-toggles">
              {root.ministries.map((m) => (
                <ToggleChip
                  key={m.id}
                  label={m.name}
                  on={value.ministryIds.includes(m.id)}
                  onClick={() => onToggleMinistry(m.id)}
                />
              ))}
            </div>
          )}

          {isPickOne && root.children.length > 0 && (
            <div className="wk-net-section">
              <p className="wk-net-section-label">Group · pick one</p>
              <div className="wk-toggles">
                {root.children.map((c) => (
                  <ToggleChip
                    key={c.network.id}
                    label={c.network.name}
                    on={value.networkIds.includes(c.network.id)}
                    onClick={() => onToggleNetwork(c.network.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {sections
            // Pick-one groups are already chips above; only show them again if they have ministries.
            .filter((n) => !(isPickOne && n.network.parentNetworkId === id && n.ministries.length === 0))
            .map((n) => (
              <div key={n.network.id} className="wk-net-section">
                <p className="wk-net-section-label">{n.network.name}</p>
                <div className="wk-toggles">
                  {!(isPickOne && n.network.parentNetworkId === id) && (
                    <ToggleChip
                      label={`Whole ${chipLabel(n.network.name)} team`}
                      title={`Everyone in ${n.network.name}`}
                      on={value.networkIds.includes(n.network.id)}
                      onClick={() => onToggleNetwork(n.network.id)}
                    />
                  )}
                  {n.ministries.map((m) => (
                    <ToggleChip
                      key={m.id}
                      label={m.name}
                      on={value.ministryIds.includes(m.id)}
                      onClick={() => onToggleMinistry(m.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default NetworkAssignments;
