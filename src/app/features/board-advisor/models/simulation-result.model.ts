export interface SimulationResult {
  totalMiniGames: number; // always 10000
  rollCountMap: Map<number, number>; // diceNumber → total times rolled across all mini-games
  resourceMap: Map<string, number>; // vertexId → avg resources per roll (averaged over mini-games)
  maxRawScore: number;
  rankedVertexIds: string[]; // descending by rawScore, excludes blocked/occupied
}
