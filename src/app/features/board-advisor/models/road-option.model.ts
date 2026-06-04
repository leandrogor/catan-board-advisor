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

export interface PlacedSettlement {
  vertexId: string;
  playerColorId: string;
}

export interface PlacedRoad {
  from: string;
  to: string;
  playerColorId: string;
}

export interface ActionSnapshot {
  settled: PlacedSettlement[];
  roads: PlacedRoad[];
  turnIndex: number;
}
