import { Injectable } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { SimulationResult } from '../models/simulation-result.model';

@Injectable({ providedIn: 'root' })
export class SimulationService {
  private static readonly TOTAL_ROLLS = 1000;

  run(hexes: HexDefinition[], vertices: Vertex[]): SimulationResult {
    const resourceMap = new Map<string, number>();
    for (const v of vertices) {
      resourceMap.set(v.id, 0);
    }

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

    for (let i = 0; i < SimulationService.TOTAL_ROLLS; i++) {
      const roll = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
      if (roll === 7) continue; // Robber

      const producingHexIds = numberToHexIds.get(roll);
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
          resourceMap.set(v.id, resourceMap.get(v.id)! + resources);
        }
      }
    }

    // Compute scores
    let maxRaw = 0;
    for (const v of vertices) {
      v.totalResources = resourceMap.get(v.id)!;
      v.rawScore = v.totalResources / SimulationService.TOTAL_ROLLS;
      if (v.rawScore > maxRaw) maxRaw = v.rawScore;
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
      totalRolls: SimulationService.TOTAL_ROLLS,
      resourceMap,
      maxRawScore: maxRaw,
      rankedVertexIds: eligible.map(v => v.id),
    };
  }
}
