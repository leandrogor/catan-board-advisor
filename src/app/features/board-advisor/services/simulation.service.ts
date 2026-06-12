import { Injectable } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { SimulationResult } from '../models/simulation-result.model';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  static readonly TOTAL_MINI_GAMES = 10000;
  static readonly ROLLS_PER_GAME = 150;

  run(
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

      for (let roll = 0; roll < rollsPerGame; roll++) {
        const diceRoll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
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
      v.normalizedScore = maxRaw > 0 ? v.rawScore / maxRaw : 0;
    }

    // Build hex lookup for desert check
    const hexMap = new Map<string, HexDefinition>();
    for (const h of hexes) {
      hexMap.set(h.id, h);
    }

    // Rank eligible vertices
    const eligible = vertices
      .filter(
        v =>
          !v.isBlocked &&
          !v.isOccupied &&
          v.adjacentHexIds.some(id => {
            const hex = hexMap.get(id);
            return hex ? !hex.isDesert : false;
          }),
      )
      .sort((a, b) => b.rawScore - a.rawScore);

    eligible.forEach((v, i) => {
      v.rank = i + 1;
    });

    // Set rank null for non-eligible
    for (const v of vertices) {
      if (!eligible.includes(v)) {
        v.rank = null;
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
}
