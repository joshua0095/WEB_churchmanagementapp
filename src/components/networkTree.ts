import type { Ministry, Network } from "../api";

export interface NetworkTreeNode {
  network: Network;
  children: NetworkTreeNode[];
  ministries: Ministry[];
}

/** Life Group Network's sub-networks are mutually exclusive — a member belongs to exactly one demographic group. */
export const SINGLE_SELECT_PARENT_NAME = "Life Group Network (LGN)";

/** Groups the flat Networks/Ministries lists into a tree (macro-network -> sub-network -> ministry). */
export function buildNetworkTree(networks: Network[], ministries: Ministry[]): NetworkTreeNode[] {
  const byParent = new Map<number | null, Network[]>();
  for (const network of networks) {
    const key = network.parentNetworkId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(network);
  }

  const build = (parentId: number | null): NetworkTreeNode[] =>
    (byParent.get(parentId) ?? []).map((network) => ({
      network,
      children: build(network.id),
      ministries: ministries.filter((m) => m.networkId === network.id),
    }));

  return build(null);
}

/** Returns the ids of every network above `networkId`, walking up ParentNetworkId to the root (e.g. WAN -> MDN). */
export function getAncestorNetworkIds(networkId: number, networks: Network[]): number[] {
  const byId = new Map(networks.map((n) => [n.id, n]));
  const ancestors: number[] = [];
  let current = byId.get(networkId);
  while (current?.parentNetworkId != null) {
    ancestors.push(current.parentNetworkId);
    current = byId.get(current.parentNetworkId);
  }
  return ancestors;
}

/** Short display code for a network name, e.g. "Church Development Network" → "CDN" — a
 * client-side derivation for tile/badge display, not a value the backend stores. */
export function abbreviateNetworkName(name: string): string {
  // Names like "Church Development Network (CDN)" already carry their code — use it as-is.
  const code = name.match(/\(([^)]+)\)\s*$/)?.[1].trim();
  if (code) return code.toUpperCase().slice(0, 4);

  // Otherwise initial each word, ignoring punctuation so "(" or "&" never becomes a letter.
  const words = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 4);
}

/** Flattens a tree into select-option order (parent immediately before its children), with a depth for indentation. */
export function flattenNetworksForSelect(tree: NetworkTreeNode[]): { id: number; name: string; depth: number }[] {
  const out: { id: number; name: string; depth: number }[] = [];
  const walk = (nodes: NetworkTreeNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ id: node.network.id, name: node.network.name, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(tree, 0);
  return out;
}
