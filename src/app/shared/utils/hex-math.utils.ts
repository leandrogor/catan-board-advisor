import { HexDefinition } from '../../features/board-advisor/models/hex.model';
import { Vertex } from '../../features/board-advisor/models/vertex.model';
import { DesertPositions } from '../../features/board-advisor/data/ext-catan-board-layout.data';

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
  const vertices: Vertex[] = [];
  const TOLERANCE_SQ = 1; // 1.0 squared, matching coordinates within 1 pixel

  for (const hex of hexes) {
    const verts = hexVertices(hex.center.x, hex.center.y, R);
    for (const v of verts) {
      // Find an existing vertex close to v
      const existing = vertices.find(other => {
        const dx = other.position.x - v.x;
        const dy = other.position.y - v.y;
        return dx * dx + dy * dy < TOLERANCE_SQ;
      });

      if (existing) {
        if (!existing.adjacentHexIds.includes(hex.id)) {
          existing.adjacentHexIds.push(hex.id);
        }
      } else {
        const key = `${Math.round(v.x * 10)}-${Math.round(v.y * 10)}`;
        vertices.push({
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

  return vertices;
}

export function buildVertexAdjacency(vertices: Vertex[], hexes: HexDefinition[], R: number): void {
  const TOLERANCE_SQ = 1;

  // For each hex, connect consecutive vertices
  for (const hex of hexes) {
    const verts = hexVertices(hex.center.x, hex.center.y, R);
    const vertexIds: string[] = [];
    for (const v of verts) {
      // Find the vertex in our list close to v
      const found = vertices.find(other => {
        const dx = other.position.x - v.x;
        const dy = other.position.y - v.y;
        return dx * dx + dy * dy < TOLERANCE_SQ;
      });
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

// ─── Spiral letter assignment ────────────────────────────────────────────────
//
// The physical Catan 5-6 extension board places letter tokens A→Zc in
// counterclockwise spiral order starting from the top-right corner.
// The canonical layout already encodes this order. We derive the spiral as a
// static ordered list of all 30 {row, col} positions — identical to reading
// EXT_CATAN_DEFAULT_LAYOUT in the order [C,B,A, P,Q,R,D, O,Za,Zb,S,E, N,Y,L1,Zc,T,F,
// M,X,L2,U,G, L,W,V,H, K,J,I] but re-expressed as (row,col) pairs.
//
// To maintain accuracy against the physical board, we hard-code the spiral as
// the (row, col) sequence read directly from the canonical layout data.

/** All 30 board positions in counterclockwise spiral order (outer ring first). */
export const SPIRAL_ORDER: readonly { row: number; col: number }[] = [
  // Outer ring, top-right corner → counterclockwise
  { row: 0, col: 2 }, // A
  { row: 0, col: 1 }, // B
  { row: 0, col: 0 }, // C
  { row: 1, col: 0 }, // D
  { row: 2, col: 0 }, // E
  { row: 3, col: 0 }, // F
  { row: 4, col: 0 }, // G
  { row: 5, col: 0 }, // H
  { row: 6, col: 0 }, // I
  { row: 6, col: 1 }, // J
  { row: 6, col: 2 }, // K
  { row: 5, col: 3 }, // L
  { row: 4, col: 4 }, // M
  { row: 3, col: 5 }, // N
  { row: 2, col: 4 }, // O
  { row: 1, col: 3 }, // P
  // Second ring
  { row: 1, col: 2 }, // Q
  { row: 1, col: 1 }, // R
  { row: 2, col: 1 }, // S
  { row: 3, col: 1 }, // T
  { row: 4, col: 1 }, // U
  { row: 5, col: 1 }, // V
  { row: 5, col: 2 }, // W
  { row: 4, col: 3 }, // X
  { row: 3, col: 4 }, // Y
  { row: 2, col: 3 }, // Za
  { row: 2, col: 2 }, // Zb
  { row: 3, col: 2 }, // Zc
  // Desert positions (inner "core")
  { row: 4, col: 2 }, // L2 default
  { row: 3, col: 3 }, // L1 default
];

/** The ordered letter tokens A→Zc (28 non-desert letters in spiral sequence). */
const SPIRAL_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Za',
  'Zb',
  'Zc',
] as const;

/**
 * Given desert positions, assigns letters A→Zc to the 28 non-desert positions
 * in spiral order, skipping whichever positions are currently deserts.
 *
 * @returns Map from `"${row}-${col}"` key → assigned letter string
 */
export function assignSpiralLetters(desertPositions: DesertPositions): Map<string, string> {
  const desertSet = new Set([
    `${desertPositions.L1.row}-${desertPositions.L1.col}`,
    `${desertPositions.L2.row}-${desertPositions.L2.col}`,
  ]);

  const result = new Map<string, string>();
  let letterIdx = 0;

  for (const pos of SPIRAL_ORDER) {
    const key = `${pos.row}-${pos.col}`;
    if (desertSet.has(key)) {
      // Desert positions get a special marker
      continue;
    }
    if (letterIdx < SPIRAL_LETTERS.length) {
      result.set(key, SPIRAL_LETTERS[letterIdx]);
      letterIdx++;
    }
  }

  return result;
}
