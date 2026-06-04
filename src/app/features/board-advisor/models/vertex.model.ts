export interface Vertex {
  id: string; // `v-${Math.round(x*10)}-${Math.round(y*10)}`
  position: { x: number; y: number };
  adjacentHexIds: string[]; // IDs of 1-3 hexes this vertex touches
  adjacentVertexIds: string[]; // IDs of vertices 1 edge away (distance rule)
  totalResources: number; // cumulative resources from simulation
  rawScore: number; // totalResources / totalRolls
  normalizedScore: number; // rawScore / maxRawScore across all vertices (0-1)
  rank: number | null; // 1 = best available; null if only desert-adjacent
  isOccupied: boolean;
  isBlocked: boolean; // adjacent to an occupied vertex
}

export interface ReachableVertex {
  vertexId: string;
  roadDistance: 1 | 2;
  score: number;
}
