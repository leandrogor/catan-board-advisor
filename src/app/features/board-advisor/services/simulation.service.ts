import { Injectable } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { EvaluationMode, SimulationResult } from '../models/simulation-result.model';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  static readonly TOTAL_MINI_GAMES = 10000;
  static readonly ROLLS_PER_GAME = 150;

  run(
    hexes: HexDefinition[],
    vertices: Vertex[],
    rollsPerGame: number = SimulationService.ROLLS_PER_GAME,
    mode: EvaluationMode = 'theoretical',
  ): SimulationResult {
    if (mode === 'theoretical') {
      return this.runTheoretical(hexes, vertices, rollsPerGame);
    }
    return this.runSimulation(hexes, vertices, rollsPerGame);
  }

  runTheoretical(
    hexes: HexDefinition[],
    vertices: Vertex[],
    rollsPerGame: number = SimulationService.ROLLS_PER_GAME,
  ): SimulationResult {
    const hexMap = new Map<string, HexDefinition>();
    for (const h of hexes) {
      hexMap.set(h.id, h);
    }

    const resourceMap = new Map<string, number>();
    let maxRaw = 0;

    for (const v of vertices) {
      let rawScore = 0;
      for (const hexId of v.adjacentHexIds) {
        const hex = hexMap.get(hexId);
        if (hex && !hex.isDesert && hex.diceNumber !== null && hex.diceNumber !== 7) {
          const ways = 6 - Math.abs(7 - hex.diceNumber);
          rawScore += ways / 36;
        }
      }
      v.rawScore = rawScore;
      v.totalResources = rawScore * rollsPerGame;
      resourceMap.set(v.id, rawScore);
      if (rawScore > maxRaw) {
        maxRaw = rawScore;
      }
    }

    for (const v of vertices) {
      v.normalizedScore = maxRaw > 0 ? (v.rawScore ?? 0) / maxRaw : 0;
    }

    // Theoretical roll count map across TOTAL_MINI_GAMES
    const rollCountMap = new Map<number, number>();
    for (let dice = 2; dice <= 12; dice++) {
      if (dice === 7) continue;
      const ways = 6 - Math.abs(7 - dice);
      const expectedRollsPerGame = (ways / 36) * rollsPerGame;
      rollCountMap.set(dice, expectedRollsPerGame * SimulationService.TOTAL_MINI_GAMES);
    }

    // Rank eligible vertices using sequential dense ranking with multi-hex & robber dispersion tie-breaking
    const eligible = vertices
      .filter(
        v =>
          !v.isBlocked &&
          !v.isOccupied &&
          (v.rawScore ?? 0) > 0 &&
          v.adjacentHexIds.some(id => {
            const hex = hexMap.get(id);
            return hex ? !hex.isDesert : false;
          }),
      )
      .sort((a, b) => {
        const scoreDiff = (b.rawScore ?? 0) - (a.rawScore ?? 0);
        if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
        const ma = this.getVertexMetrics(a, hexMap);
        const mb = this.getVertexMetrics(b, hexMap);
        if (mb.hexCount !== ma.hexCount) return mb.hexCount - ma.hexCount;
        if (Math.abs(ma.robberConcentration - mb.robberConcentration) > 1e-6) {
          return ma.robberConcentration - mb.robberConcentration;
        }
        return ma.key.localeCompare(mb.key);
      });

    let currentRank = 1;
    let prevItem: { score: number; hexCount: number; robberConcentration: number } | null = null;
    for (const v of eligible) {
      const score = v.rawScore ?? 0;
      const m = this.getVertexMetrics(v, hexMap);
      if (
        prevItem !== null &&
        Math.abs(score - prevItem.score) < 1e-6 &&
        m.hexCount === prevItem.hexCount &&
        Math.abs(m.robberConcentration - prevItem.robberConcentration) < 1e-6
      ) {
        // Structurally and mathematically tied -> same rank
      } else {
        if (prevItem !== null) currentRank++;
        prevItem = { score, hexCount: m.hexCount, robberConcentration: m.robberConcentration };
      }
      v.rank = currentRank;
    }

    const lastProductionRank = prevItem !== null ? currentRank + 1 : 1;
    for (const v of vertices) {
      if (!eligible.includes(v)) {
        v.rank = lastProductionRank;
      }
    }

    return {
      totalMiniGames: SimulationService.TOTAL_MINI_GAMES,
      rollCountMap,
      resourceMap,
      maxRawScore: maxRaw,
      rankedVertexIds: eligible.map(v => v.id),
    };
  }

  runSimulation(
    hexes: HexDefinition[],
    vertices: Vertex[],
    rollsPerGame: number = SimulationService.ROLLS_PER_GAME,
  ): SimulationResult {
    // Build a lookup: diceNumber -> list of hex IDs with that number
    const numberToHexIds = new Map<number, string[]>();
    for (const hex of hexes) {
      if (hex.diceNumber !== null) {
        const existing = numberToHexIds.get(hex.diceNumber);
        if (existing) {
          existing.push(hex.id);
        } else {
          numberToHexIds.set(hex.diceNumber, [hex.id]);
        }
      }
    }

    // Pre-build vertex -> set of adjacent hex IDs for fast lookup
    const vertexAdjacentHexSet = new Map<string, Set<string>>();
    for (const v of vertices) {
      vertexAdjacentHexSet.set(v.id, new Set(v.adjacentHexIds));
    }

    // miniGameScores[vertexId] = array of (resources / rollsPerGame) for each mini-game
    const miniGameScores = new Map<string, number[]>();
    for (const v of vertices) {
      miniGameScores.set(v.id, []);
    }

    // Track total times each dice number was rolled across all mini-games
    const rollCountMap = new Map<number, number>();

    for (let game = 0; game < SimulationService.TOTAL_MINI_GAMES; game++) {
      // Per-game resource accumulator
      const gameResources = new Map<string, number>();
      for (const v of vertices) {
        gameResources.set(v.id, 0);
      }

      const randomValues = new Uint32Array(rollsPerGame * 2);
      crypto.getRandomValues(randomValues);
      let randIdx = 0;

      for (let roll = 0; roll < rollsPerGame; roll++) {
        const diceRoll = (randomValues[randIdx++] % 6) + 1 + (randomValues[randIdx++] % 6) + 1;
        if (diceRoll === 7) continue; // Robber — no resources produced

        // Tally roll count for this dice value
        rollCountMap.set(diceRoll, (rollCountMap.get(diceRoll) ?? 0) + 1);

        const producingHexIds = numberToHexIds.get(diceRoll);
        if (!producingHexIds) continue;

        for (const v of vertices) {
          const adjSet = vertexAdjacentHexSet.get(v.id)!;
          let resources = 0;
          for (const hexId of producingHexIds) {
            if (adjSet.has(hexId)) {
              resources++;
            }
          }
          if (resources > 0) {
            gameResources.set(v.id, gameResources.get(v.id)! + resources);
          }
        }
      }

      // Record per-game score as resources-per-roll for this mini-game
      for (const v of vertices) {
        miniGameScores.get(v.id)!.push(gameResources.get(v.id)! / rollsPerGame);
      }
    }

    // Compute final scores: average of all mini-game scores
    let maxRaw = 0;
    const resourceMap = new Map<string, number>();

    for (const v of vertices) {
      const scores = miniGameScores.get(v.id)!;
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      v.totalResources = avg * rollsPerGame; // representative resources over one game
      v.rawScore = avg;
      resourceMap.set(v.id, avg);
      if (avg > maxRaw) maxRaw = avg;
    }

    for (const v of vertices) {
      v.normalizedScore = maxRaw > 0 ? (v.rawScore ?? 0) / maxRaw : 0;
    }

    // Build hex lookup for desert check
    const hexMap = new Map<string, HexDefinition>();
    for (const h of hexes) {
      hexMap.set(h.id, h);
    }

    // Rank eligible vertices using sequential dense ranking with multi-hex & robber dispersion tie-breaking
    const eligible = vertices
      .filter(
        v =>
          !v.isBlocked &&
          !v.isOccupied &&
          (v.rawScore ?? 0) > 0 &&
          v.adjacentHexIds.some(id => {
            const hex = hexMap.get(id);
            return hex ? !hex.isDesert : false;
          }),
      )
      .sort((a, b) => {
        const scoreDiff = (b.rawScore ?? 0) - (a.rawScore ?? 0);
        if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
        const ma = this.getVertexMetrics(a, hexMap);
        const mb = this.getVertexMetrics(b, hexMap);
        if (mb.hexCount !== ma.hexCount) return mb.hexCount - ma.hexCount;
        if (Math.abs(ma.robberConcentration - mb.robberConcentration) > 1e-6) {
          return ma.robberConcentration - mb.robberConcentration;
        }
        return ma.key.localeCompare(mb.key);
      });

    let currentRank = 1;
    let prevItem: { score: number; hexCount: number; robberConcentration: number } | null = null;
    for (const v of eligible) {
      const score = v.rawScore ?? 0;
      const m = this.getVertexMetrics(v, hexMap);
      if (
        prevItem !== null &&
        Math.abs(score - prevItem.score) < 1e-6 &&
        m.hexCount === prevItem.hexCount &&
        Math.abs(m.robberConcentration - prevItem.robberConcentration) < 1e-6
      ) {
        // Tied with previous score and structure -> same rank
      } else {
        if (prevItem !== null) currentRank++;
        prevItem = { score, hexCount: m.hexCount, robberConcentration: m.robberConcentration };
      }
      v.rank = currentRank;
    }

    // Set rank for non-eligible to last position in production ranking
    const lastProductionRank = prevItem !== null ? currentRank + 1 : 1;
    for (const v of vertices) {
      if (!eligible.includes(v)) {
        v.rank = lastProductionRank;
      }
    }

    return {
      totalMiniGames: SimulationService.TOTAL_MINI_GAMES,
      rollCountMap,
      resourceMap,
      maxRawScore: maxRaw,
      rankedVertexIds: eligible.map(v => v.id),
    };
  }

  private getVertexMetrics(
    v: Vertex,
    hexMap: Map<string, HexDefinition>,
  ): { hexCount: number; robberConcentration: number; key: string } {
    const diceNumbers: number[] = [];
    for (const id of v.adjacentHexIds) {
      const hex = hexMap.get(id);
      if (hex && !hex.isDesert && hex.diceNumber !== null && hex.diceNumber !== 7) {
        diceNumbers.push(hex.diceNumber);
      }
    }
    diceNumbers.sort((a, b) => a - b);
    const hexCount = diceNumbers.length;
    const totalPips = diceNumbers.reduce((sum, d) => sum + (6 - Math.abs(7 - d)), 0);
    const maxPips = diceNumbers.reduce((max, d) => Math.max(max, 6 - Math.abs(7 - d)), 0);
    const robberConcentration = totalPips > 0 ? maxPips / totalPips : 1;
    return {
      hexCount,
      robberConcentration,
      key: diceNumbers.join('-'),
    };
  }
}
