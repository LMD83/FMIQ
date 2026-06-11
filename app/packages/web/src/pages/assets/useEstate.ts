import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, getAsset, listAssets, type AssetListFilter } from '../../api';
import type { RagTone } from '../../components/StatusBadge';

/** Estate hierarchy node — site > building > floor > space (PRD-asset-register-import §4.2 tree view). */
export interface EstateNode {
  id: string;
  kind: 'site' | 'building' | 'floor' | 'space';
  name: string;
  meta?: string | null;
  assetCount?: number;
  children: EstateNode[];
}

// GET /api/v1/locations/tree response (domain/assets.ts locationTree)
interface TreeSpace { id: string; name: string; spaceType: string; assetCount: number }
interface TreeFloor { id: string; name: string; levelIndex: number; assetCount: number; spaces: TreeSpace[] }
interface TreeBuilding { id: string; name: string; assetCount: number; directAssets: number; floors: TreeFloor[] }
interface TreeSite { id: string; name: string; assetCount: number; buildings: TreeBuilding[] }

async function fetchEstateTree(): Promise<EstateNode[]> {
  const { sites } = await api<{ sites: TreeSite[] }>('/api/v1/locations/tree');
  return sites.map((s) => ({
    id: s.id, kind: 'site' as const, name: s.name, assetCount: s.assetCount,
    children: s.buildings.map((b) => ({
      id: b.id, kind: 'building' as const, name: b.name, assetCount: b.assetCount,
      meta: b.directAssets > 0 ? `${b.directAssets} attached at building level` : null,
      children: b.floors.map((f) => ({
        id: f.id, kind: 'floor' as const, name: f.name, assetCount: f.assetCount,
        children: f.spaces.map((sp) => ({
          id: sp.id, kind: 'space' as const, name: sp.name, assetCount: sp.assetCount, children: [],
        })),
      })),
    })),
  }));
}

export const useEstateTree = () =>
  useQuery({ queryKey: ['estate-tree'], queryFn: fetchEstateTree });

/** Server-side search/filter/pagination over GET /api/v1/assets. */
export const useAssets = (filter: AssetListFilter = {}) =>
  useQuery({
    queryKey: ['assets', filter],
    queryFn: () => listAssets(filter),
    placeholderData: keepPreviousData,
  });

/** GET /api/v1/assets/:id — { asset, provenance, audit }. */
export const useAssetDetail = (id: string | undefined) =>
  useQuery({ queryKey: ['asset', id], queryFn: () => getAsset(id as string), enabled: !!id });

/** Resolve the full Site / Building / Floor / Space chain for an asset from the cached tree. */
export function locationChain(
  tree: EstateNode[] | undefined,
  anchor: { spaceId: string | null; buildingId: string | null },
): string | null {
  if (!tree) return null;
  const walk = (nodes: EstateNode[], path: string[]): string[] | null => {
    for (const n of nodes) {
      const next = [...path, n.name];
      if ((anchor.spaceId && n.kind === 'space' && n.id === anchor.spaceId)
        || (!anchor.spaceId && anchor.buildingId && n.kind === 'building' && n.id === anchor.buildingId)) {
        return next;
      }
      const found = walk(n.children, next);
      if (found) return found;
    }
    return null;
  };
  const chain = walk(tree, []);
  return chain ? chain.join(' / ') : null;
}

export function conditionTone(grade: string | null): RagTone {
  switch (grade) {
    case 'A': return 'ok';
    case 'B': return 'info';
    case 'C': return 'amber';
    case 'D': return 'crit';
    default: return 'neutral';
  }
}

export function criticalityTone(criticality: string | null): RagTone {
  const c = (criticality ?? '').toLowerCase();
  if (c.includes('critical') || c === 'red') return 'crit';
  if (c.includes('important') || c.includes('high') || c === 'amber') return 'amber';
  if (!c) return 'neutral';
  return 'ok';
}
