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
  type?: 'settlement' | 'city';
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
  gameActivePlayerId?: string | null;
  appPhase?: 'setup' | 'results' | 'game';
  longestRoadOwnerId?: string | null;
  largestArmyOwnerId?: string | null;
  devCardsPurchased?: Record<string, number>;
  devCardsPlayed?: import('./dev-card.model').PlayedDevCard[];
  gameHistory?: import('./game-history.model').GameHistoryEntry[];
}
