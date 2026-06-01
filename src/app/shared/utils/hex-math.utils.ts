import { HexDefinition } from '../../features/board-advisor/models/hex.model';
import { Vertex } from '../../features/board-advisor/models/vertex.model';

const WIDEST_ROW = 6;
const ROW_SIZES = [3, 4, 5, 6, 5, 4, 3];

export function computeHexSize(viewportWidth: number): number {
  const maxBoardWidth = Math.min(viewportWidth * 0.95, 520);
  // The widest row has 6 hexes. Total width = 6 * hexSpacingX + some padding
  // hexSpacingX = R * sqrt(3)
  // Total approx width = WIDEST_ROW * R * sqrt(3)
  return maxBoardWidth / (WIDEST_ROW * Math.sqrt(3));
}

export function hexCenter(row: number, col: number, R: number): { x: number; y: number } {
  const hexSpacingX = R * Math.sqrt(3);
  const rowSpacingY = R * 1.5;
  const rowSize = ROW_SIZES[row];
  const startX = ((WIDEST_ROW - rowSize) * hexSpacingX) / 2;
  return {
    x: startX + col * hexSpacingX,
    y: row * rowSpacingY,
  };
}

export function hexVertices(cx: number, cy: number, R: number): { x: number; y: number }[] {
  // Pointy-top hex vertices:
  // V0 (top): 90deg, V1 (upper-right): 30deg, V2 (lower-right): -30deg
  // V3 (bottom): -90deg, V4 (lower-left): -150deg (=210), V5 (upper-left): 150deg
  const angleDegrees = [90, 30, -30, -90, -150, 150];
  return angleDegrees.map(deg => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + R * Math.cos(rad),
      y: cy - R * Math.sin(rad), // SVG y-axis is inverted
    };
  });
}

export function deduplicateVertices(hexes: HexDefinition[], R: number): Vertex[] {
  const vertexMap = new Map<string, Vertex>();

  for (const hex of hexes) {
    const verts = hexVertices(hex.center.x, hex.center.y, R);
    for (const v of verts) {
      const key = `${Math.round(v.x * 10)}-${Math.round(v.y * 10)}`;
      const existing = vertexMap.get(key);
      if (existing) {
        if (!existing.adjacentHexIds.includes(hex.id)) {
          existing.adjacentHexIds.push(hex.id);
        }
      } else {
        vertexMap.set(key, {
          id: `v-${key}`,
          position: { x: v.x, y: v.y },
          adjacentHexIds: [hex.id],
          adjacentVertexIds: [],
          totalResources: 0,
          rawScore: 0,
          normalizedScore: 0,
          rank: null,
          isOccupied: false,
          isBlocked: false,
        });
      }
    }
  }

  return Array.from(vertexMap.values());
}

export function buildVertexAdjacency(vertices: Vertex[], hexes: HexDefinition[], R: number): void {
  // Create a lookup from vertex position key to vertex
  const vertexByKey = new Map<string, Vertex>();
  for (const v of vertices) {
    const key = `${Math.round(v.position.x * 10)}-${Math.round(v.position.y * 10)}`;
    vertexByKey.set(key, v);
  }

  // For each hex, connect consecutive vertices
  for (const hex of hexes) {
    const verts = hexVertices(hex.center.x, hex.center.y, R);
    const vertexIds: string[] = [];
    for (const v of verts) {
      const key = `${Math.round(v.x * 10)}-${Math.round(v.y * 10)}`;
      const found = vertexByKey.get(key);
      if (found) {
        vertexIds.push(found.id);
      }
    }

    for (let i = 0; i < vertexIds.length; i++) {
      const aId = vertexIds[i];
      const bId = vertexIds[(i + 1) % vertexIds.length];
      const vA = vertices.find(v => v.id === aId);
      const vB = vertices.find(v => v.id === bId);
      if (vA && vB) {
        if (!vA.adjacentVertexIds.includes(vB.id)) {
          vA.adjacentVertexIds.push(vB.id);
        }
        if (!vB.adjacentVertexIds.includes(vA.id)) {
          vB.adjacentVertexIds.push(vA.id);
        }
      }
    }
  }
}

export function computeViewBox(
  hexes: HexDefinition[],
  R: number,
  padding = 20,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const hex of hexes) {
    const verts = hexVertices(hex.center.x, hex.center.y, R);
    for (const v of verts) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  }
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function hexPolygonPoints(cx: number, cy: number, R: number): string {
  return hexVertices(cx, cy, R)
    .map(v => `${v.x},${v.y}`)
    .join(' ');
}

export function interpolateHeatmapColor(normalizedScore: number): string {
  // 0.0-0.5: blue (#3b82f6) -> yellow (#fbbf24)
  // 0.5-1.0: yellow (#fbbf24) -> red (#ef4444)
  if (normalizedScore <= 0.5) {
    const t = normalizedScore * 2; // 0-1
    return interpolateColor([59, 130, 246], [251, 191, 36], t);
  } else {
    const t = (normalizedScore - 0.5) * 2; // 0-1
    return interpolateColor([251, 191, 36], [239, 68, 68], t);
  }
}

function interpolateColor(
  from: [number, number, number],
  to: [number, number, number],
  t: number,
): string {
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `rgb(${r},${g},${b})`;
}
