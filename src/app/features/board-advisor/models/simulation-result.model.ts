export interface SimulationResult {
  totalRolls: number; // always 1000
  resourceMap: Map<string, number>; // vertexId -> totalResources
  maxRawScore: number;
  rankedVertexIds: string[]; // descending by rawScore, excludes blocked/occupied
}
