import { useState } from "react";
import type { Ministry, Network } from "../../api";
import { abbreviateNetworkName, type NetworkTreeNode } from "../networkTree";
import { KebabIcon, NavChevronIcon } from "./shellIcons";
import DropdownMenu from "./DropdownMenu";

// Matches the design reference's square kebab button, in place of DropdownMenu's default
// circular trigger (kept as-is for every other place it's used, e.g. table row actions).
const KEBAB_PROPS = { icon: <KebabIcon />, triggerClassName: "settings-kebab" };

interface TreeListProps {
  tree: NetworkTreeNode[];
  onEditNetwork: (network: Network) => void;
  onDeleteNetwork: (network: Network) => void;
  onEditMinistry: (ministry: Ministry) => void;
  onDeleteMinistry: (ministry: Ministry) => void;
}

interface TreeBranchProps {
  node: NetworkTreeNode;
  depth: number;
  onEditNetwork: (network: Network) => void;
  onDeleteNetwork: (network: Network) => void;
  onEditMinistry: (ministry: Ministry) => void;
  onDeleteMinistry: (ministry: Ministry) => void;
}

/** A sub-network's own row plus its ministries and (recursively) its own sub-networks —
 * everything under a root network's top .net-head, indented one level deeper each time. */
function TreeBranch({ node, depth, onEditNetwork, onDeleteNetwork, onEditMinistry, onDeleteMinistry }: TreeBranchProps) {
  return (
    <>
      <div className="tree-node tree-node--subnet" style={{ marginLeft: depth * 20 }}>
        <span className="tree-node-name">{node.network.name}</span>
        <span className="tree-chip tree-chip--sub">Sub-network</span>
        {node.network.systemKey === "MIS" && (
          <span className="tree-chip tree-chip--sub" title="Members of this network get the MIS role">
            Grants MIS role
          </span>
        )}
        <DropdownMenu
          {...KEBAB_PROPS}
          ariaLabel={`Actions for ${node.network.name}`}
          items={[
            { label: "Edit", onSelect: () => onEditNetwork(node.network) },
            // Built-in networks (e.g. MIS) can be renamed but not deleted — the API refuses it too.
            ...(node.network.systemKey
              ? []
              : [{ label: "Delete", onSelect: () => onDeleteNetwork(node.network), danger: true, dividerBefore: true }]),
          ]}
        />
      </div>
      {node.ministries.map((ministry) => (
        <div key={ministry.id} className="tree-node tree-node--leaf" style={{ marginLeft: depth * 20 + 28 }}>
          <span className="tree-node-name">{ministry.name}</span>
          <DropdownMenu
            {...KEBAB_PROPS}
            ariaLabel={`Actions for ${ministry.name}`}
            items={[
              { label: "Edit", onSelect: () => onEditMinistry(ministry) },
              { label: "Delete", onSelect: () => onDeleteMinistry(ministry), danger: true, dividerBefore: true },
            ]}
          />
        </div>
      ))}
      {node.children.map((child) => (
        <TreeBranch
          key={child.network.id}
          node={child}
          depth={depth + 1}
          onEditNetwork={onEditNetwork}
          onDeleteNetwork={onDeleteNetwork}
          onEditMinistry={onEditMinistry}
          onDeleteMinistry={onDeleteMinistry}
        />
      ))}
    </>
  );
}

/** Collapsible network → sub-network → ministry tree, matching the Networks settings panel:
 * each root network is a card with a code badge and a count ("N sub-networks" or "N
 * ministries"), expanding to list its own ministries then each sub-network's own. */
function TreeList({ tree, onEditNetwork, onDeleteNetwork, onEditMinistry, onDeleteMinistry }: TreeListProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const toggle = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (tree.length === 0) {
    return <p className="px-7 py-6 text-sm text-[var(--color-text-secondary)]">No networks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3 px-7 pb-2">
      {tree.map((root) => {
        const expanded = !collapsed.has(root.network.id);
        const count =
          root.children.length > 0
            ? `${root.children.length} sub-network${root.children.length === 1 ? "" : "s"}`
            : `${root.ministries.length} ministr${root.ministries.length === 1 ? "y" : "ies"}`;
        return (
          <div key={root.network.id} className="tree-card">
            <div className="tree-card-head">
              <button
                type="button"
                className="tree-toggle"
                aria-expanded={expanded}
                aria-label={`${expanded ? "Hide" : "Show"} ${root.network.name}`}
                onClick={() => toggle(root.network.id)}
              >
                <NavChevronIcon className={expanded ? "" : "-rotate-90"} />
              </button>
              <span className="tree-code">{abbreviateNetworkName(root.network.name)}</span>
              <span className="tree-card-title">
                <span className="tree-card-name">{root.network.name}</span>
                <span className="tree-card-count">{count}</span>
              </span>
              <DropdownMenu
                {...KEBAB_PROPS}
                ariaLabel={`Actions for ${root.network.name}`}
                items={[
                  { label: "Edit", onSelect: () => onEditNetwork(root.network) },
                  { label: "Delete", onSelect: () => onDeleteNetwork(root.network), danger: true, dividerBefore: true },
                ]}
              />
            </div>
            {expanded && (
              <div className="tree-body">
                {root.ministries.length === 0 && root.children.length === 0 ? (
                  <p className="py-2 text-sm text-[var(--color-text-secondary)]">No ministries yet.</p>
                ) : (
                  <>
                    {root.ministries.map((ministry) => (
                      <div key={ministry.id} className="tree-node tree-node--leaf">
                        <span className="tree-node-name">{ministry.name}</span>
                        <DropdownMenu
                          {...KEBAB_PROPS}
                          ariaLabel={`Actions for ${ministry.name}`}
                          items={[
                            { label: "Edit", onSelect: () => onEditMinistry(ministry) },
                            {
                              label: "Delete",
                              onSelect: () => onDeleteMinistry(ministry),
                              danger: true,
                              dividerBefore: true,
                            },
                          ]}
                        />
                      </div>
                    ))}
                    {root.children.map((child) => (
                      <TreeBranch
                        key={child.network.id}
                        node={child}
                        depth={0}
                        onEditNetwork={onEditNetwork}
                        onDeleteNetwork={onDeleteNetwork}
                        onEditMinistry={onEditMinistry}
                        onDeleteMinistry={onDeleteMinistry}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TreeList;
