import { HexDefinition } from '../../features/board-advisor/models/hex.model';
import { Vertex } from '../../features/board-advisor/models/vertex.model';
import { DesertState } from '../../features/board-advisor/data/ext-catan-board-layout.data';

// ─── Extension board geometry (7 rows, widest = 6) ──────────────────────────

const EXT_WIDEST_ROW = 6;
const EXT_ROW_SIZES = [3, 4, 5, 6, 5, 4, 3];

export function computeHexSize(viewportWidth: number): number {
  const maxBoardWidth = Math.min(viewportWidth * 0.95, 520);
  return maxBoardWidth / (EXT_WIDEST_ROW * Math.sqrt(3));
}

export function hexCenter(row: number, col: number, R: number): { x: number; y: number } {
  const hexSpacingX = R * Math.sqrt(3);
  const rowSpacingY = R * 1.5;
  const rowSize = EXT_ROW_SIZES[row];
  const startX = ((EXT_WIDEST_ROW - rowSize) * hexSpacingX) / 2;
  return {
    x: startX + col * hexSpacingX,
    y: row * rowSpacingY,
  };
}

// ─── Base board geometry (5 rows, widest = 5) ────────────────────────────────

const BASE_WIDEST_ROW = 5;
const BASE_ROW_SIZES = [3, 4, 5, 4, 3];

export function computeBaseHexSize(viewportWidth: number): number {
  const maxBoardWidth = Math.min(viewportWidth * 0.95, 520);
  return maxBoardWidth / (BASE_WIDEST_ROW * Math.sqrt(3));
}

export function baseHexCenter(row: number, col: number, R: number): { x: number; y: number } {
  const hexSpacingX = R * Math.sqrt(3);
  const rowSpacingY = R * 1.5;
  const rowSize = BASE_ROW_SIZES[row];
  const startX = ((BASE_WIDEST_ROW - rowSize) * hexSpacingX) / 2;
  return {
    x: startX + col * hexSpacingX,
    y: row * rowSpacingY,
  };
}

// ─── Shared hex vertex / adjacency helpers ────────────────────────────────────

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
  const refR = 100;
  const isExtension = hexes.length > 19;

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
        // Calculate reference coordinates for the ID using refR = 100
        const cx_ref = isExtension
          ? hexCenter(hex.row, hex.col, refR).x
          : baseHexCenter(hex.row, hex.col, refR).x;
        const cy_ref = isExtension
          ? hexCenter(hex.row, hex.col, refR).y
          : baseHexCenter(hex.row, hex.col, refR).y;

        // Which vertex index is this? (0 to 5)
        const hexVerts = hexVertices(hex.center.x, hex.center.y, R);
        const index = hexVerts.findIndex(hv => {
          const dx = hv.x - v.x;
          const dy = hv.y - v.y;
          return dx * dx + dy * dy < TOLERANCE_SQ;
        });

        // Get the corresponding vertex coordinates at refR = 100
        const refVerts = hexVertices(cx_ref, cy_ref, refR);
        const refV = refVerts[index !== -1 ? index : 0];

        const key = `${Math.round(refV.x * 10)}-${Math.round(refV.y * 10)}`;
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

// ─── Extension spiral letter assignment ──────────────────────────────────────
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

/** All 30 extension board positions in counterclockwise spiral order (outer ring first). */
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

/** The ordered letter tokens A→Zc (28 non-desert letters in ext spiral sequence). */
const EXT_SPIRAL_LETTERS = [
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
 * Given extension desert positions, assigns letters A→Zc to the 28 non-desert
 * positions in spiral order, skipping whichever positions are currently deserts.
 *
 * @returns Map from `"${row}-${col}"` key → assigned letter string
 */
export function assignSpiralLetters(desertPositions: DesertState): Map<string, string> {
  const desertSet = new Set([`${desertPositions.L1.row}-${desertPositions.L1.col}`]);
  if (desertPositions.variant === 'ext') {
    desertSet.add(`${desertPositions.L2.row}-${desertPositions.L2.col}`);
  }

  const result = new Map<string, string>();
  let letterIdx = 0;

  for (const pos of SPIRAL_ORDER) {
    const key = `${pos.row}-${pos.col}`;
    if (desertSet.has(key)) {
      continue;
    }
    if (letterIdx < EXT_SPIRAL_LETTERS.length) {
      result.set(key, EXT_SPIRAL_LETTERS[letterIdx]);
      letterIdx++;
    }
  }

  return result;
}

// ─── Base game spiral letter assignment ──────────────────────────────────────
//
// The base game (3-4 players) has 18 hexes in a 3-4-5-4-3 layout.
// Letters A→R (17 non-desert letters) are placed counterclockwise from
// the top-right corner, matching the user-confirmed layout:
//
//    C  B  A            Row 0: (0,2) A  (0,1) B  (0,0) C
//   D  N  M  L          Row 1: (1,0) D  (1,1) N  (1,2) M  (1,3) L
//  E  O  L1  R  K       Row 2: (2,0) E  (2,1) O  (2,2) L1 (2,3) R  (2,4) K
//   F  P  Q  J          Row 3: (3,0) F  (3,1) P  (3,2) Q  (3,3) J
//    G  H  I             Row 4: (4,0) G  (4,1) H  (4,2) I
//
// Reading the outer ring counterclockwise from top-right gives:
//   A, B, C, D, E, F, G, H, I, J, K, L → 12 outer positions
// Then the inner ring:
//   M, N, O, P, Q, R → 6 inner positions
// Desert (L1) defaults to center (2,2).

/** All 18 base board positions in counterclockwise spiral order. */
export const BASE_SPIRAL_ORDER: readonly { row: number; col: number }[] = [
  // Outer ring, top-right → counterclockwise
  { row: 0, col: 2 }, // A
  { row: 0, col: 1 }, // B
  { row: 0, col: 0 }, // C
  { row: 1, col: 0 }, // D
  { row: 2, col: 0 }, // E
  { row: 3, col: 0 }, // F
  { row: 4, col: 0 }, // G
  { row: 4, col: 1 }, // H
  { row: 4, col: 2 }, // I
  { row: 3, col: 3 }, // J
  { row: 2, col: 4 }, // K
  { row: 1, col: 3 }, // L
  // Inner ring
  { row: 1, col: 2 }, // M
  { row: 1, col: 1 }, // N
  { row: 2, col: 1 }, // O
  { row: 3, col: 1 }, // P
  { row: 3, col: 2 }, // Q
  { row: 2, col: 3 }, // R
  // Desert default: center
  { row: 2, col: 2 }, // L1 default
];

/** The ordered letter tokens A→R (17 non-desert letters in base spiral sequence). */
const BASE_SPIRAL_LETTERS = [
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
] as const;

/**
 * Given a base-game desert position, assigns letters A→R to the 17 non-desert
 * positions in spiral order.
 *
 * @returns Map from `"${row}-${col}"` key → assigned letter string
 */
export function assignBaseSpiralLetters(desertPos: {
  row: number;
  col: number;
}): Map<string, string> {
  const desertKey = `${desertPos.row}-${desertPos.col}`;
  const result = new Map<string, string>();
  let letterIdx = 0;

  for (const pos of BASE_SPIRAL_ORDER) {
    const key = `${pos.row}-${pos.col}`;
    if (key === desertKey) {
      continue;
    }
    if (letterIdx < BASE_SPIRAL_LETTERS.length) {
      result.set(key, BASE_SPIRAL_LETTERS[letterIdx]);
      letterIdx++;
    }
  }

  return result;
}
