import { useState, type CSSProperties } from 'react';
import type { EstateNode } from './useEstate';

/**
 * Estate hierarchy tree (site > building > floor > space). Selecting a node scopes
 * the asset table server-side (siteId/buildingId/spaceId; floors scope to their
 * building). Keyboard-operable: every node is a real button.
 */
export function EstateTree({
  nodes, selectedId, onSelect,
}: {
  nodes: EstateNode[];
  selectedId: string | null;
  onSelect: (chain: EstateNode[]) => void;
}) {
  return (
    <nav aria-label="Estate hierarchy">
      <button
        type="button"
        className="tree-node"
        aria-current={selectedId === null ? 'true' : undefined}
        style={rowStyle(0, selectedId === null)}
        onClick={() => onSelect([])}
      >
        All sites
      </button>
      {nodes.map((n) => <TreeBranch key={n.id} node={n} chain={[]} depth={0} selectedId={selectedId} onSelect={onSelect} />)}
      {!nodes.length && <div className="muted" style={{ fontSize: 12, padding: '6px 8px' }}>No estate data.</div>}
    </nav>
  );
}

function TreeBranch({
  node, chain, depth, selectedId, onSelect,
}: {
  node: EstateNode;
  chain: EstateNode[];
  depth: number;
  selectedId: string | null;
  onSelect: (chain: EstateNode[]) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const selected = selectedId === node.id;
  const nextChain = [...chain, node];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={{ width: 22, marginLeft: depth * 14, color: 'var(--slate)', fontSize: 11 }}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span style={{ width: 22, marginLeft: depth * 14 }} aria-hidden />
        )}
        <button
          type="button"
          className="tree-node"
          aria-current={selected ? 'true' : undefined}
          style={{ ...rowStyle(0, selected), flex: 1 }}
          onClick={() => onSelect(nextChain)}
        >
          <span style={{ fontWeight: depth === 0 ? 600 : 500 }}>{node.name}</span>
          {node.assetCount != null && <span className="muted tnum" style={{ marginLeft: 'auto', fontSize: 11 }}>{node.assetCount}</span>}
        </button>
      </div>
      {node.meta && <div className="muted" style={{ fontSize: 11, margin: `0 0 4px ${22 + depth * 14}px` }}>{node.meta}</div>}
      {open && hasChildren && node.children.map((c) => (
        <TreeBranch key={c.id} node={c} chain={nextChain} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function rowStyle(indent: number, selected: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    textAlign: 'left' as const,
    padding: '6px 8px',
    marginLeft: indent,
    borderRadius: 6,
    fontSize: 13,
    fontFamily: 'var(--f-ui)',
    background: selected ? 'var(--pale-stone)' : 'transparent',
    color: selected ? 'var(--charcoal)' : 'var(--slate)',
  };
}
