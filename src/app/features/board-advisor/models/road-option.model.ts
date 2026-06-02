export interface RoadOption {
  rank: number;
  toVertexId: string;
  toVertexScore: number;
  bestProjectedVertexId: string | null;
  bestProjectedScore: number;
  pathScore: number;
  requiresExtraRoad: boolean;
  projectionPath: string[];
}

export interface ActionSnapshot {
  settled: string[];
  roads: { from: string; to: string }[];
}
