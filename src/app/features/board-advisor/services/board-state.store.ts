import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { SimulationResult } from '../models/simulation-result.model';
import {
  RoadOption,
  ActionSnapshot,
  PlacedSettlement,
  PlacedRoad,
} from '../models/road-option.model';
import { PlayerColor, PLAYER_COLORS } from '../models/player-color.model';
import { BoardVariant } from '../models/board-variant.model';
import {
  DesertState,
  ExtDesertState,
  DEFAULT_EXT_DESERT_STATE,
} from '../data/ext-catan-board-layout.data';
import { BASE_DEFAULT_DESERT_POSITION } from '../data/base-catan-board-layout.data';
import { BoardLayoutService } from './board-layout.service';
import { SimulationService } from './simulation.service';
import {
  assignSpiralLetters,
  assignBaseSpiralLetters,
  computeHexSize,
  computeBaseHexSize,
  deduplicateVertices,
  buildVertexAdjacency,
  computeViewBox,
} from '../../../shared/utils/hex-math.utils';

export type AppPhase = 'setup' | 'results' | 'game';
export type PlayerCount = 3 | 4 | 5 | 6;
export type BoardRotationDeg = 0 | 90 | 180 | 270;

@Injectable({ providedIn: 'root' })
export class BoardStateStore {
  // ── Settings ────────────────────────────────────────────────────────────────
  readonly scoreFormat = signal<'decimal' | 'percentage'>(
    (localStorage.getItem('catan-score-fmt') as 'decimal' | 'percentage') ?? 'decimal',
  );
  readonly showZeroScores = signal<boolean>(localStorage.getItem('catan-show-zeros') !== 'false');
  readonly enableAutoZoom = signal<boolean>(localStorage.getItem('catan-auto-zoom') !== 'false');

  // ── Phase ───────────────────────────────────────────────────────────────────
  /** Current app phase: 'setup' shows letters+drag UI; 'results' shows heatmap. */
  readonly appPhase = signal<AppPhase>('setup');

  // ── Player setup ────────────────────────────────────────────────────────────
  readonly playerCount = signal<PlayerCount>(3);
  readonly playerColors = signal<PlayerColor[]>(PLAYER_COLORS.slice(0, 3));
  readonly myPlayerColorId = signal<PlayerColor['id'] | null>(null);

  /** Which physical board is in use: 'base' for 3-4 players, 'ext' for 5-6. */
  readonly boardVariant = computed<BoardVariant>(() => (this.playerCount() <= 4 ? 'base' : 'ext'));

  readonly rollsPerGame = computed<number>(() => {
    const map: Record<number, number> = {
      3: 80,
      4: 100,
      5: 125,
      6: 150,
    };
    return map[this.playerCount()] ?? 150;
  });

  // ── Board state ─────────────────────────────────────────────────────────────
  readonly desertState = signal<DesertState>({
    variant: 'base',
    L1: { ...BASE_DEFAULT_DESERT_POSITION },
  });
  readonly placedSettlements = signal<PlacedSettlement[]>([]);
  readonly placedRoads = signal<PlacedRoad[]>([]);
  readonly undoStack = signal<ActionSnapshot[]>([]);
  readonly redoStack = signal<ActionSnapshot[]>([]);
  readonly desertUndoStack = signal<DesertState[]>([]);
  readonly desertRedoStack = signal<DesertState[]>([]);
  readonly selectedVertexId = signal<string | null>(null);
  readonly selectedHexId = signal<string | null>(null);
  readonly boardRotationDeg = signal<BoardRotationDeg>(0);
  readonly isSimulating = signal<boolean>(false);
  readonly hexSize = signal<number>(computeBaseHexSize(window.innerWidth));
  readonly gameActivePlayerId = signal<string | null>(null);
  readonly activeBuildTool = signal<'road' | 'settlement' | 'city' | null>(null);
  readonly longestRoadOwnerId = signal<string | null>(null);

  // ── Road selection state ───────────────────────────────────────────────────
  readonly isSelectingRoad = signal<boolean>(false);
  readonly pendingSettlementVertexId = signal<string | null>(null);
  readonly currentRoadOptions = signal<RoadOption[]>([]);

  /**
   * Global toggle for Phase 1: show dice numbers instead of spiral letters.
   */
  readonly showNumbersInSetup = signal<boolean>(false);

  readonly panelVisible = signal<boolean>(true);

  // ── Turn tracking ─────────────────────────────────────────────────────────
  readonly currentTurnIndex = signal<number>(0);

  readonly turnSequence = computed<PlayerColor[]>(() => {
    const c = this.playerColors();
    return [...c, ...c.slice().reverse()];
  });

  readonly currentPlayerColor = computed<PlayerColor | null>(() => {
    if (this.appPhase() === 'game') {
      const activeId = this.gameActivePlayerId();
      if (activeId) {
        return this.playerColors().find(c => c.id === activeId) ?? null;
      }
      return this.playerColors()[0] ?? null;
    }
    return this.turnSequence()[this.currentTurnIndex()] ?? null;
  });

  readonly totalTurns = computed<number>(() => this.playerCount() * 2);

  readonly isSetupComplete = computed<boolean>(() => this.currentTurnIndex() >= this.totalTurns());

  // ── Simulation result (private writable, public readonly) ───────────────────
  private readonly _simulationResult = signal<SimulationResult | null>(null);
  readonly simulationResult = this._simulationResult.asReadonly();

  // ── Longest Road ───────────────────────────────────────────────────────────
  readonly playerLongestRoads = computed<Record<string, { length: number; path: PlacedRoad[] }>>(
    () => {
      const result: Record<string, { length: number; path: PlacedRoad[] }> = {};
      for (const player of this.playerColors()) {
        result[player.id] = this.calculateLongestRoadForPlayer(player.id);
      }
      return result;
    },
  );

  readonly longestRoadLengths = computed<Record<string, number>>(() => {
    const lengths: Record<string, number> = {};
    const details = this.playerLongestRoads();
    for (const id of Object.keys(details)) {
      lengths[id] = details[id].length;
    }
    return lengths;
  });

  readonly longestRoadDetails = computed(() => {
    const ownerId = this.longestRoadOwnerId();
    if (!ownerId) return null;
    const details = this.playerLongestRoads()[ownerId];
    if (!details) return null;
    return {
      ownerId,
      length: details.length,
      path: details.path,
    };
  });

  readonly playerScores = computed(() => {
    const colors = this.playerColors();
    const placements = this.placedSettlements();
    const scored = this.scoredVertices();
    const lengths = this.longestRoadLengths();

    // Build vertex score lookup
    const vertexScoreMap = new Map<string, number>();
    for (const v of scored) {
      vertexScoreMap.set(v.id, v.rawScore);
    }

    return colors.map(color => {
      const myPlacements = placements.filter(p => p.playerColorId === color.id);
      const settlementsCount = myPlacements.filter(p => p.type === 'settlement' || !p.type).length;
      const citiesCount = myPlacements.filter(p => p.type === 'city').length;
      const roadsCount = this.placedRoads().filter(r => r.playerColorId === color.id).length;
      const hasLongestRoad = this.longestRoadOwnerId() === color.id;
      const score = settlementsCount * 1 + citiesCount * 2 + (hasLongestRoad ? 2 : 0);

      // Compute average production rate for active game scoreboard
      let totalProd = 0;
      if (myPlacements.length > 0) {
        totalProd = myPlacements.reduce((sum, p) => sum + (vertexScoreMap.get(p.vertexId) ?? 0), 0);
      }
      const avgProd = myPlacements.length > 0 ? totalProd / myPlacements.length : 0;

      return {
        color,
        settlementsCount,
        citiesCount,
        roadsCount,
        score,
        avgProd,
        longestRoadLength: lengths[color.id] ?? 0,
        hasLongestRoad,
      };
    });
  });

  readonly gameWinner = computed<PlayerColor | null>(() => {
    if (this.appPhase() !== 'game') return null;
    const scores = this.playerScores();
    const winnerRow = scores.find(s => s.score >= 10);
    return winnerRow ? winnerRow.color : null;
  });

  readonly validSettlementSpots = computed<string[]>(() => {
    if (this.appPhase() !== 'game' || this.activeBuildTool() !== 'settlement') return [];
    const activeId = this.currentPlayerColor()?.id;
    if (!activeId) return [];

    const counts = this.getPlayerPieceCounts(activeId);
    if (counts.settlements >= 5) return [];

    const vertices = this.scoredVertices();
    return vertices
      .filter(v => !v.isOccupied && !v.isBlocked && this.hasRoadConnected(v.id, activeId))
      .map(v => v.id);
  });

  readonly validCitySpots = computed<string[]>(() => {
    if (this.appPhase() !== 'game' || this.activeBuildTool() !== 'city') return [];
    const activeId = this.currentPlayerColor()?.id;
    if (!activeId) return [];

    const counts = this.getPlayerPieceCounts(activeId);
    if (counts.cities >= 4) return [];

    return this.placedSettlements()
      .filter(s => s.playerColorId === activeId && s.type !== 'city')
      .map(s => s.vertexId);
  });

  readonly validRoadEdges = computed<
    { from: string; to: string; p1: { x: number; y: number }; p2: { x: number; y: number } }[]
  >(() => {
    if (this.appPhase() !== 'game' || this.activeBuildTool() !== 'road') return [];
    const activeId = this.currentPlayerColor()?.id;
    if (!activeId) return [];

    const counts = this.getPlayerPieceCounts(activeId);
    if (counts.roads >= 15) return [];

    const vertices = this.allVertices();
    const vertexMap = new Map<string, Vertex>();
    for (const v of vertices) {
      vertexMap.set(v.id, v);
    }

    const edges: {
      from: string;
      to: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
    }[] = [];
    const addedKeys = new Set<string>();

    for (const v1 of vertices) {
      const isV1ValidStart = this.isValidRoadStart(v1.id, activeId);

      for (const adjId of v1.adjacentVertexIds) {
        const key = v1.id < adjId ? `${v1.id}_${adjId}` : `${adjId}_${v1.id}`;
        if (addedKeys.has(key)) continue;

        const v2 = vertexMap.get(adjId);
        if (!v2) continue;

        const isV2ValidStart = this.isValidRoadStart(v2.id, activeId);

        if (!isV1ValidStart && !isV2ValidStart) continue;
        if (this.hasRoadOnEdge(v1.id, v2.id)) continue;

        addedKeys.add(key);
        // Always orient so p1 = source (valid road start) for correct animation direction.
        // If both vertices are valid starts, v1 is treated as source (arbitrary but consistent).
        if (isV1ValidStart) {
          edges.push({ from: v1.id, to: v2.id, p1: v1.position, p2: v2.position });
        } else {
          // Only v2 is the valid start – swap so p1 is the source
          edges.push({ from: v2.id, to: v1.id, p1: v2.position, p2: v1.position });
        }
      }
    }
    return edges;
  });

  // ── Computed: hex grid ───────────────────────────────────────────────────────
  readonly hexes = computed<HexDefinition[]>(() =>
    this.layoutService.buildHexGrid(this.desertState(), this.hexSize()),
  );

  /** Maps `"${row}-${col}"` → assigned spiral letter (for Phase 1 display). */
  readonly spiralLetterAssignment = computed<ReadonlyMap<string, string>>(() => {
    const ds = this.desertState();
    if (ds.variant === 'base') {
      return assignBaseSpiralLetters(ds.L1);
    }
    return assignSpiralLetters(ds);
  });

  // ── Computed: vertices (deduplicated with adjacency) ─────────────────────────
  readonly allVertices = computed<Vertex[]>(() => {
    const hexes = this.hexes();
    const R = this.hexSize();
    const vertices = deduplicateVertices(hexes, R);
    buildVertexAdjacency(vertices, hexes, R);
    return vertices;
  });

  // ── Computed: settled vertex IDs (derived from placedSettlements) ────────────
  readonly settledVertexIds = computed<string[]>(() =>
    this.placedSettlements().map(s => s.vertexId),
  );

  // ── Computed: scored vertices (with settlement state applied) ────────────────
  readonly scoredVertices = computed<Vertex[]>(() => {
    const result = this.simulationResult();
    const vertices = this.allVertices();
    const settled = this.settledVertexIds();

    return vertices.map(v => {
      const copy = { ...v };
      copy.isOccupied = settled.includes(v.id);
      copy.isBlocked =
        !copy.isOccupied && v.adjacentVertexIds.some(adjId => settled.includes(adjId));

      if (result) {
        copy.rawScore = result.resourceMap.get(v.id) ?? 0;
        copy.totalResources = copy.rawScore * this.rollsPerGame();
        copy.normalizedScore = result.maxRawScore > 0 ? copy.rawScore / result.maxRawScore : 0;
      }
      return copy;
    });
  });

  // ── Re-rank after settlement state changes ───────────────────────────────────
  readonly rankedVertices = computed<Vertex[]>(() => {
    const vertices = this.scoredVertices();
    const hexes = this.hexes();
    const hexMap = new Map<string, HexDefinition>();
    for (const h of hexes) {
      hexMap.set(h.id, h);
    }

    for (const v of vertices) {
      v.rank = null;
    }

    const eligible = vertices.filter(
      v =>
        !v.isBlocked &&
        !v.isOccupied &&
        v.adjacentHexIds.some(id => {
          const hex = hexMap.get(id);
          return hex !== undefined && !hex.isDesert;
        }),
    );

    // Group eligible vertices by structuralKey (adjacent non-null diceNumbers sorted ascending and joined)
    const groupsMap = new Map<string, Vertex[]>();
    for (const v of eligible) {
      const diceNumbers: number[] = [];
      for (const id of v.adjacentHexIds) {
        const hex = hexMap.get(id);
        if (hex && !hex.isDesert && hex.diceNumber !== null) {
          diceNumbers.push(hex.diceNumber);
        }
      }
      diceNumbers.sort((a, b) => a - b);
      const structuralKey = diceNumbers.join('-');

      if (!groupsMap.has(structuralKey)) {
        groupsMap.set(structuralKey, []);
      }
      groupsMap.get(structuralKey)!.push(v);
    }

    // Sort groups by their mean rawScore descending
    const groupList = Array.from(groupsMap.entries()).map(([key, groupVertices]) => {
      const totalScore = groupVertices.reduce((sum, v) => sum + (v.rawScore ?? 0), 0);
      const meanScore = totalScore / groupVertices.length;
      return {
        key,
        vertices: groupVertices,
        meanScore,
      };
    });
    groupList.sort((a, b) => b.meanScore - a.meanScore);

    // Assign rank with 1224 rule: rank of a group = 1 + total number of vertices in all higher-ranked groups
    let runningCount = 0;
    for (const group of groupList) {
      const groupRank = 1 + runningCount;
      for (const v of group.vertices) {
        v.rank = groupRank;
      }
      runningCount += group.vertices.length;
    }

    return vertices;
  });

  readonly topVertex = computed<Vertex | null>(
    () => this.rankedVertices().find(v => v.rank === 1) ?? null,
  );

  getSettlementAt(vertexId: string): PlacedSettlement | undefined {
    return this.placedSettlements().find(s => s.vertexId === vertexId);
  }

  hasRoadConnected(vertexId: string, playerColorId: string): boolean {
    return this.placedRoads().some(
      r => r.playerColorId === playerColorId && (r.from === vertexId || r.to === vertexId),
    );
  }

  isValidRoadStart(vertexId: string, playerColorId: string): boolean {
    const settlement = this.placedSettlements().find(s => s.vertexId === vertexId);
    if (settlement) {
      return settlement.playerColorId === playerColorId;
    }
    // No settlement at vertex, check if player has a road connected and no opponent occupies it
    const hasRoad = this.placedRoads().some(
      r => r.playerColorId === playerColorId && (r.from === vertexId || r.to === vertexId),
    );
    if (!hasRoad) return false;

    // Since there's no settlement at vertex, it's not occupied by an opponent
    return true;
  }

  hasRoadOnEdge(v1: string, v2: string): boolean {
    return this.placedRoads().some(
      r => (r.from === v1 && r.to === v2) || (r.from === v2 && r.to === v1),
    );
  }

  getPlayerPieceCounts(playerColorId: string) {
    const list = this.placedSettlements().filter(s => s.playerColorId === playerColorId);
    const settlements = list.filter(s => s.type === 'settlement' || !s.type).length;
    const cities = list.filter(s => s.type === 'city').length;
    const roads = this.placedRoads().filter(r => r.playerColorId === playerColorId).length;
    return { settlements, cities, roads };
  }

  calculateLongestRoadForPlayer(playerColorId: string): { length: number; path: PlacedRoad[] } {
    const myRoads = this.placedRoads().filter(r => r.playerColorId === playerColorId);
    if (myRoads.length === 0) return { length: 0, path: [] };

    // Find opponent settled vertex IDs
    const opponentSettled = new Set(
      this.placedSettlements()
        .filter(s => s.playerColorId !== playerColorId)
        .map(s => s.vertexId),
    );

    // Build adjacency list for roads
    const adj = new Map<string, { to: string; road: PlacedRoad }[]>();
    for (const r of myRoads) {
      if (!adj.has(r.from)) adj.set(r.from, []);
      if (!adj.has(r.to)) adj.set(r.to, []);
      adj.get(r.from)!.push({ to: r.to, road: r });
      adj.get(r.to)!.push({ to: r.from, road: r });
    }

    let bestPath: PlacedRoad[] = [];
    const visitedRoads = new Set<PlacedRoad>();

    const dfs = (v: string): PlacedRoad[] => {
      // If vertex is blocked by opponent and we already have traversed some roads
      if (opponentSettled.has(v) && visitedRoads.size > 0) {
        return [];
      }

      let bestSubPath: PlacedRoad[] = [];
      const edges = adj.get(v) || [];
      for (const edge of edges) {
        if (!visitedRoads.has(edge.road)) {
          visitedRoads.add(edge.road);
          const subPath = dfs(edge.to);
          const fullSubPath = [edge.road, ...subPath];
          if (fullSubPath.length > bestSubPath.length) {
            bestSubPath = fullSubPath;
          }
          visitedRoads.delete(edge.road); // backtrack
        }
      }
      return bestSubPath;
    };

    // Run DFS from each vertex in the road network
    for (const startNode of adj.keys()) {
      const path = dfs(startNode);
      if (path.length > bestPath.length) {
        bestPath = path;
      }
    }

    return {
      length: bestPath.length,
      path: bestPath,
    };
  }

  recalculateLongestRoadOwner(): void {
    const lengths = this.longestRoadLengths();
    const currentOwner = this.longestRoadOwnerId();

    // Find max length
    let maxLength = 0;
    const players = this.playerColors();
    for (const p of players) {
      const len = lengths[p.id] ?? 0;
      if (len > maxLength) {
        maxLength = len;
      }
    }

    // Minimum road length of 5 is required to qualify
    if (maxLength < 5) {
      this.longestRoadOwnerId.set(null);
      return;
    }

    const topPlayers = players.filter(p => (lengths[p.id] ?? 0) === maxLength);

    if (currentOwner) {
      const currentOwnerLength = lengths[currentOwner] ?? 0;
      // Current owner keeps the card if they are still tied for the longest (even if length changed)
      if (currentOwnerLength === maxLength) {
        return;
      }
      // If current owner is no longer in the lead:
      if (topPlayers.length === 1) {
        // Unique new leader
        this.longestRoadOwnerId.set(topPlayers[0].id);
      } else {
        // Tie among leaders, card returns to bank
        this.longestRoadOwnerId.set(null);
      }
    } else if (topPlayers.length === 1) {
      // No current owner: must be a unique leader to claim
      this.longestRoadOwnerId.set(topPlayers[0].id);
    }
  }

  readonly myExpansionSuggestions = computed(() => {
    const myColor = this.myPlayerColorId();
    if (
      !myColor ||
      (this.appPhase() !== 'results' && this.appPhase() !== 'game') ||
      this.gameWinner()
    ) {
      return [];
    }

    const mySettlements = this.placedSettlements().filter(s => s.playerColorId === myColor);
    const myRoads = this.placedRoads().filter(r => r.playerColorId === myColor);
    const vertices = this.scoredVertices();

    const suggestions: {
      settlementVertexId: string;
      targetVertexId: string;
      newRoads: { from: string; to: string }[];
      score: number;
    }[] = [];

    for (const s of mySettlements) {
      // Find the roads connected to this settlement
      const connectedRoads = myRoads.filter(r => r.from === s.vertexId || r.to === s.vertexId);
      const endpoints = connectedRoads.map(r => (r.from === s.vertexId ? r.to : r.from));

      const sVertex = vertices.find(v => v.id === s.vertexId);
      if (!sVertex) continue;

      let bestCandidate: {
        targetVertexId: string;
        newRoads: { from: string; to: string }[];
        score: number;
      } | null = null;

      // --- Priority 1: 1-road extension from endpoints (E -> T) ---
      const p1Candidates: {
        targetVertexId: string;
        newRoads: { from: string; to: string }[];
        score: number;
      }[] = [];
      for (const ep of endpoints) {
        const epVertex = vertices.find(v => v.id === ep);
        if (!epVertex) continue;

        for (const adjId of epVertex.adjacentVertexIds) {
          if (adjId === s.vertexId || endpoints.includes(adjId)) continue;
          const vAdj = vertices.find(v => v.id === adjId);
          if (vAdj && !vAdj.isOccupied && !vAdj.isBlocked) {
            p1Candidates.push({
              targetVertexId: adjId,
              newRoads: [{ from: ep, to: adjId }],
              score: vAdj.rawScore,
            });
          }
        }
      }

      if (p1Candidates.length > 0) {
        p1Candidates.sort((a, b) => b.score - a.score);
        bestCandidate = p1Candidates[0];
      }

      // --- Priority 2: 2-road extension from endpoints (E -> T -> U) ---
      if (!bestCandidate) {
        const p2Candidates: {
          targetVertexId: string;
          newRoads: { from: string; to: string }[];
          score: number;
        }[] = [];
        for (const ep of endpoints) {
          const epVertex = vertices.find(v => v.id === ep);
          if (!epVertex) continue;

          for (const tId of epVertex.adjacentVertexIds) {
            if (tId === s.vertexId || endpoints.includes(tId)) continue;
            const vT = vertices.find(v => v.id === tId);
            // Can build road through T only if it is not occupied by an opponent
            if (vT && !vT.isOccupied) {
              for (const uId of vT.adjacentVertexIds) {
                if (uId === ep || uId === s.vertexId) continue;
                const vU = vertices.find(v => v.id === uId);
                if (vU && !vU.isOccupied && !vU.isBlocked) {
                  p2Candidates.push({
                    targetVertexId: uId,
                    newRoads: [
                      { from: ep, to: tId },
                      { from: tId, to: uId },
                    ],
                    score: vU.rawScore,
                  });
                }
              }
            }
          }
        }

        if (p2Candidates.length > 0) {
          p2Candidates.sort((a, b) => b.score - a.score);
          bestCandidate = p2Candidates[0];
        }
      }

      // --- Priority 3: 2-road paths from S along other connections (S -> A -> B) ---
      if (!bestCandidate) {
        const p3Candidates: {
          targetVertexId: string;
          newRoads: { from: string; to: string }[];
          score: number;
        }[] = [];
        // Other connections are adjacent vertices of S that are not part of endpoints
        const otherAdjs = sVertex.adjacentVertexIds.filter(adjId => !endpoints.includes(adjId));
        for (const aId of otherAdjs) {
          const vA = vertices.find(v => v.id === aId);
          // Can build road through A only if not occupied
          if (vA && !vA.isOccupied) {
            for (const bId of vA.adjacentVertexIds) {
              if (bId === s.vertexId) continue;
              const vB = vertices.find(v => v.id === bId);
              if (vB && !vB.isOccupied && !vB.isBlocked) {
                p3Candidates.push({
                  targetVertexId: bId,
                  newRoads: [
                    { from: s.vertexId, to: aId },
                    { from: aId, to: bId },
                  ],
                  score: vB.rawScore,
                });
              }
            }
          }
        }

        if (p3Candidates.length > 0) {
          p3Candidates.sort((a, b) => b.score - a.score);
          bestCandidate = p3Candidates[0];
        }
      }

      if (bestCandidate) {
        suggestions.push({
          settlementVertexId: s.vertexId,
          targetVertexId: bestCandidate.targetVertexId,
          newRoads: bestCandidate.newRoads,
          score: bestCandidate.score,
        });
      }
    }

    return suggestions;
  });

  readonly viewBox = computed(() => computeViewBox(this.hexes(), this.hexSize()));

  private readonly layoutService = inject(BoardLayoutService);
  private readonly simService = inject(SimulationService);

  constructor() {
    // Persist settings
    effect(() => {
      localStorage.setItem('catan-score-fmt', this.scoreFormat());
    });
    effect(() => {
      localStorage.setItem('catan-show-zeros', String(this.showZeroScores()));
    });
    effect(() => {
      localStorage.setItem('catan-auto-zoom', String(this.enableAutoZoom()));
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  /**
   * Starts the Monte Carlo simulation asynchronously.
   * Sets isSimulating=true, defers to next tick so the overlay renders,
   * then runs the simulation and transitions to Phase 2.
   */
  startSimulation(): void {
    if (this.isSimulating()) return;
    this.selectedHexId.set(null);
    this.selectedVertexId.set(null);
    this.isSimulating.set(true);
    const hexes = this.hexes();
    const vertices = this.allVertices();
    const rolls = this.rollsPerGame();
    // Yield execution to the browser for 100ms to guarantee style recalc & paint
    // of the simulation overlay before blocking the main thread with CPU-bound work.
    setTimeout(() => {
      const result = this.simService.run(hexes, [...vertices.map(v => ({ ...v }))], rolls);
      this._simulationResult.set(result);
      this.isSimulating.set(false);
      this.appPhase.set('results');
    }, 100);
  }

  /**
   * Resets the board for setup: clears simulation, settlements, roads,
   * turn tracking, undo/redo stacks, and returns to Phase 1.
   * Player count, player color order, player "Me" selection, and desert positions are preserved.
   */
  resetToSetup(): void {
    this._simulationResult.set(null);
    this.placedSettlements.set([]);
    this.placedRoads.set([]);
    this.isSelectingRoad.set(false);
    this.pendingSettlementVertexId.set(null);
    this.currentRoadOptions.set([]);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.desertUndoStack.set([]);
    this.desertRedoStack.set([]);
    this.selectedVertexId.set(null);
    this.selectedHexId.set(null);
    this.showNumbersInSetup.set(false);
    this.currentTurnIndex.set(0);
    this.activeBuildTool.set(null);
    this.longestRoadOwnerId.set(null);
    this.appPhase.set('setup');
  }

  startGamePhase(): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: null,
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    const firstColor = this.playerColors()[0]?.id ?? 'red';
    this.gameActivePlayerId.set(firstColor);
    this.activeBuildTool.set(null);
    this.appPhase.set('game');
  }

  selectActivePlayerInGame(playerColorId: string): void {
    if (this.appPhase() !== 'game') return;
    this.gameActivePlayerId.set(playerColorId);
    this.activeBuildTool.set(null);
  }

  placeSettlement(vertexId: string): void {
    const colorId = this.currentPlayerColor()?.id ?? 'red';
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list => [
      ...list,
      { vertexId, playerColorId: colorId, type: 'settlement' },
    ]);
    this.recalculateLongestRoadOwner();
    this.selectedVertexId.set(null);
  }

  buildSettlement(vertexId: string): void {
    const colorId = this.currentPlayerColor()?.id ?? 'red';
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list => [
      ...list,
      { vertexId, playerColorId: colorId, type: 'settlement' },
    ]);
    this.recalculateLongestRoadOwner();
    this.activeBuildTool.set(null);
    this.selectedVertexId.set(null);
  }

  upgradeToCity(vertexId: string): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list =>
      list.map(s => (s.vertexId === vertexId ? { ...s, type: 'city' } : s)),
    );
    this.recalculateLongestRoadOwner();
    this.activeBuildTool.set(null);
    this.selectedVertexId.set(null);
  }

  buildRoad(fromId: string, toId: string): void {
    const colorId = this.currentPlayerColor()?.id ?? 'red';
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    this.placedRoads.update(roads => [
      ...roads,
      { from: fromId, to: toId, playerColorId: colorId },
    ]);
    this.recalculateLongestRoadOwner();
    this.activeBuildTool.set(null);
    this.selectedVertexId.set(null);
  }

  removeSettlement(vertexId: string): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
        longestRoadOwnerId: this.longestRoadOwnerId(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list => list.filter(s => s.vertexId !== vertexId));
    this.placedRoads.update(roads => roads.filter(r => r.from !== vertexId && r.to !== vertexId));
    this.recalculateLongestRoadOwner();
    this.selectedVertexId.set(null);
  }

  undo(): void {
    if (this.appPhase() === 'setup') {
      const stack = this.desertUndoStack();
      if (!stack.length) return;
      this.desertRedoStack.update(r => [...r, { ...this.desertState() }]);
      this.desertState.set(stack.at(-1)!);
      this.desertUndoStack.update(s => s.slice(0, -1));
    } else {
      const stack = this.undoStack();
      if (!stack.length) return;
      this.redoStack.update(r => [
        ...r,
        {
          settled: this.placedSettlements(),
          roads: this.placedRoads(),
          turnIndex: this.currentTurnIndex(),
          gameActivePlayerId: this.gameActivePlayerId(),
          appPhase: this.appPhase(),
          longestRoadOwnerId: this.longestRoadOwnerId(),
        },
      ]);
      const last = stack.at(-1)!;
      this.placedSettlements.set(last.settled);
      this.placedRoads.set(last.roads);
      this.currentTurnIndex.set(last.turnIndex);
      if (last.gameActivePlayerId !== undefined) {
        this.gameActivePlayerId.set(last.gameActivePlayerId);
      }
      if (last.appPhase !== undefined) {
        this.appPhase.set(last.appPhase);
      }
      this.longestRoadOwnerId.set(last.longestRoadOwnerId ?? null);
      this.undoStack.update(s => s.slice(0, -1));
      this.selectedVertexId.set(null);
    }
  }

  redo(): void {
    if (this.appPhase() === 'setup') {
      const stack = this.desertRedoStack();
      if (!stack.length) return;
      this.desertUndoStack.update(u => [...u, { ...this.desertState() }]);
      this.desertState.set(stack.at(-1)!);
      this.desertRedoStack.update(r => r.slice(0, -1));
    } else {
      const stack = this.redoStack();
      if (!stack.length) return;
      this.undoStack.update(u => [
        ...u,
        {
          settled: this.placedSettlements(),
          roads: this.placedRoads(),
          turnIndex: this.currentTurnIndex(),
          gameActivePlayerId: this.gameActivePlayerId(),
          appPhase: this.appPhase(),
          longestRoadOwnerId: this.longestRoadOwnerId(),
        },
      ]);
      const last = stack.at(-1)!;
      this.placedSettlements.set(last.settled);
      this.placedRoads.set(last.roads);
      this.currentTurnIndex.set(last.turnIndex);
      if (last.gameActivePlayerId !== undefined) {
        this.gameActivePlayerId.set(last.gameActivePlayerId);
      }
      if (last.appPhase !== undefined) {
        this.appPhase.set(last.appPhase);
      }
      this.longestRoadOwnerId.set(last.longestRoadOwnerId ?? null);
      this.redoStack.update(r => r.slice(0, -1));
      this.selectedVertexId.set(null);
    }
  }

  /**
   * Moves a desert to a target position.
   * For the base game (single desert), only L1 is movable; L2 is ignored.
   * For the extension (two deserts), if the target is occupied by the other desert they swap.
   * Resets settled vertices and undo/redo when deserts change.
   */
  updateDesertPosition(desert: 'L1' | 'L2', pos: { row: number; col: number }): void {
    const current = this.desertState();

    if (current.variant === 'base') {
      // Base game: only L1 is draggable
      if (desert !== 'L1') return;
      const myCurrentPos = current.L1;
      if (myCurrentPos.row === pos.row && myCurrentPos.col === pos.col) return;

      this.desertUndoStack.update(s => [...s, { ...current }]);
      this.desertRedoStack.set([]);
      this.desertState.set({ variant: 'base', L1: pos });
    } else {
      // Extension: L1 and L2 both draggable; dropping on each other swaps
      const other = desert === 'L1' ? 'L2' : 'L1';
      const otherPos = current[other];
      const myCurrentPos = current[desert];
      if (myCurrentPos.row === pos.row && myCurrentPos.col === pos.col) return;

      this.desertUndoStack.update(s => [...s, { ...current }]);
      this.desertRedoStack.set([]);

      if (otherPos.row === pos.row && otherPos.col === pos.col) {
        const next: ExtDesertState =
          desert === 'L1'
            ? { variant: 'ext', L1: pos, L2: myCurrentPos }
            : { variant: 'ext', L1: myCurrentPos, L2: pos };
        this.desertState.set(next);
      } else {
        this.desertState.set({ ...current, [desert]: pos } as ExtDesertState);
      }
    }

    this.placedSettlements.set([]);
    this.placedRoads.set([]);
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.showNumbersInSetup.set(false);
    this.selectedHexId.set(null);
  }

  startSelectingRoad(vertexId: string): void {
    this.isSelectingRoad.set(true);
    this.pendingSettlementVertexId.set(vertexId);
    const options = this.computeRoadOptionsForVertex(vertexId);
    this.currentRoadOptions.set(options);
    this.panelVisible.set(false);
  }

  cancelRoadSelection(): void {
    this.isSelectingRoad.set(false);
    this.pendingSettlementVertexId.set(null);
    this.currentRoadOptions.set([]);
  }

  confirmRoadSelection(toVertexId: string): void {
    const fromId = this.pendingSettlementVertexId();
    if (!fromId) return;

    const colorId = this.currentPlayerColor()?.id ?? 'red';

    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
        gameActivePlayerId: this.gameActivePlayerId(),
        appPhase: this.appPhase(),
      },
    ]);
    this.redoStack.set([]);

    if (this.appPhase() === 'game') {
      // In game phase: only place the road
      this.placedRoads.update(roads => [
        ...roads,
        { from: fromId, to: toVertexId, playerColorId: colorId },
      ]);
    } else {
      // In setup phase: place settlement + road, and advance turn
      this.placedSettlements.update(list => [
        ...list,
        { vertexId: fromId, playerColorId: colorId, type: 'settlement' },
      ]);
      this.placedRoads.update(roads => [
        ...roads,
        { from: fromId, to: toVertexId, playerColorId: colorId },
      ]);
      this.currentTurnIndex.update(i => i + 1);
    }

    this.isSelectingRoad.set(false);
    this.pendingSettlementVertexId.set(null);
    this.currentRoadOptions.set([]);
    this.selectedVertexId.set(null);
    this.panelVisible.set(true);
  }

  computeRoadOptionsForVertex(vertexId: string): RoadOption[] {
    const vertices = this.scoredVertices();
    const v = vertices.find(x => x.id === vertexId);
    if (!v) return [];

    const options: RoadOption[] = [];
    for (const adjId of v.adjacentVertexIds) {
      if (this.hasRoadOnEdge(vertexId, adjId)) continue;
      const a = vertices.find(x => x.id === adjId);
      if (!a) continue;

      const directScore = a.rawScore;

      // From A, collect all B in A.adjacentVertexIds where B.id !== V.id and B is not occupied
      const bVertices = a.adjacentVertexIds
        .filter(bId => bId !== vertexId)
        .map(bId => vertices.find(x => x.id === bId))
        .filter((b): b is Vertex => b !== undefined && !b.isOccupied);

      interface ProjectionPath {
        targetId: string;
        score: number;
        cost: 1 | 2;
        path: string[];
      }

      const paths: ProjectionPath[] = [];

      for (const b of bVertices) {
        if (b.isBlocked) {
          // B is blocked, look at adjacent C (excluding A, V, not occupied, not blocked)
          const cVertices = b.adjacentVertexIds
            .filter(cId => cId !== adjId && cId !== vertexId)
            .map(cId => vertices.find(x => x.id === cId))
            .filter((c): c is Vertex => c !== undefined && !c.isOccupied && !c.isBlocked);

          for (const c of cVertices) {
            paths.push({
              targetId: c.id,
              score: c.rawScore,
              cost: 2,
              path: [b.id, c.id],
            });
          }
        } else {
          paths.push({
            targetId: b.id,
            score: b.rawScore,
            cost: 1,
            path: [b.id],
          });
        }
      }

      // Find the best path:
      // Preference: cost=1 (no extra road) > cost=2 (extra road)
      // Then by score descending
      let bestPath: ProjectionPath | null = null;
      const cost1Paths = paths.filter(p => p.cost === 1);
      if (cost1Paths.length > 0) {
        bestPath = cost1Paths.reduce(
          (prev, curr) => (curr.score > prev.score ? curr : prev),
          cost1Paths[0],
        );
      } else {
        const cost2Paths = paths.filter(p => p.cost === 2);
        if (cost2Paths.length > 0) {
          bestPath = cost2Paths.reduce(
            (prev, curr) => (curr.score > prev.score ? curr : prev),
            cost2Paths[0],
          );
        }
      }

      const bestProjectedVertexId = bestPath ? bestPath.targetId : null;
      const bestProjectedScore = bestPath ? bestPath.score : 0;
      const requiresExtraRoad = bestPath ? bestPath.cost === 2 : false;
      const projectionPath = bestPath ? bestPath.path : [];

      options.push({
        rank: 0,
        toVertexId: adjId,
        toVertexScore: directScore,
        bestProjectedVertexId,
        bestProjectedScore,
        pathScore: bestProjectedScore,
        requiresExtraRoad,
        projectionPath,
      });
    }

    // Sort options:
    // 1. requiresExtraRoad (false first, true last)
    // 2. pathScore descending
    options.sort((a, b) => {
      if (a.requiresExtraRoad !== b.requiresExtraRoad) {
        return a.requiresExtraRoad ? 1 : -1;
      }
      return b.pathScore - a.pathScore;
    });

    options.forEach((opt, idx) => {
      opt.rank = idx + 1;
    });

    return options;
  }

  /**
   * Toggles Phase 1 display between letter (default) and dice number for all hexes.
   */
  toggleHexDisplay(): void {
    this.showNumbersInSetup.update(v => !v);
  }

  selectHex(id: string | null): void {
    this.selectedHexId.set(id);
    // Deselect vertex when a hex is selected
    if (id !== null) this.selectedVertexId.set(null);
  }

  rotateBoard(): void {
    this.boardRotationDeg.update(r => ((r + 90) % 360) as BoardRotationDeg);
  }

  selectVertex(id: string | null): void {
    this.selectedVertexId.set(id);
    if (id !== null) this.selectedHexId.set(null);
  }

  updateHexSize(viewportWidth: number): void {
    const variant = this.boardVariant();
    if (variant === 'base') {
      this.hexSize.set(computeBaseHexSize(viewportWidth));
    } else {
      this.hexSize.set(computeHexSize(viewportWidth));
    }
  }

  toggleScoreFormat(): void {
    this.scoreFormat.update(f => (f === 'decimal' ? 'percentage' : 'decimal'));
  }

  toggleShowZeroScores(): void {
    this.showZeroScores.update(v => !v);
  }

  toggleAutoZoom(): void {
    this.enableAutoZoom.update(v => !v);
  }

  /**
   * Changes the player count.
   * - Crossing the 4→5 boundary switches the board variant.
   * - Desert state is migrated: L1 position is preserved; L2 is added/removed.
   * - When reducing player slots (6→5→4→3), the last slot is dropped.
   * - When adding slots, the first unused color is appended.
   * - Player color order is always preserved.
   */
  setPlayerCount(count: PlayerCount): void {
    if (count === this.playerCount()) return;

    const prevVariant = this.boardVariant();
    const newVariant: BoardVariant = count <= 4 ? 'base' : 'ext';

    // Migrate desert state if the board variant changes
    if (prevVariant !== newVariant) {
      if (newVariant === 'base') {
        // ext → base: always start from the base-board default (center).
        this.desertState.set({ variant: 'base', L1: { ...BASE_DEFAULT_DESERT_POSITION } });
      } else {
        // base → ext: always start from the ext-board defaults.
        this.desertState.set({ ...DEFAULT_EXT_DESERT_STATE });
      }

      // Clear settlements/roads when board changes (they would reference wrong positions)
      this.placedSettlements.set([]);
      this.placedRoads.set([]);
      this.undoStack.set([]);
      this.redoStack.set([]);
      this.desertUndoStack.set([]);
      this.desertRedoStack.set([]);
      this.currentTurnIndex.set(0);

      // Recalculate hex size for the new board
      if (newVariant === 'base') {
        this.hexSize.set(computeBaseHexSize(window.innerWidth));
      } else {
        this.hexSize.set(computeHexSize(window.innerWidth));
      }
    }

    this.playerCount.set(count);

    // Adjust color slots
    const current = this.playerColors();
    if (count > current.length) {
      // Add missing slots
      const usedIds = new Set(current.map(c => c.id));
      const added = [...current];
      while (added.length < count) {
        const unused = PLAYER_COLORS.find(c => !usedIds.has(c.id));
        if (unused) {
          added.push(unused);
          usedIds.add(unused.id);
        } else {
          added.push(PLAYER_COLORS[added.length % PLAYER_COLORS.length]);
        }
      }
      this.playerColors.set(added);
    } else if (count < current.length) {
      this.playerColors.update(list => list.slice(0, count));
    }
  }

  /**
   * Swaps colors between slots. If the chosen color is already in another slot,
   * that slot receives the current slot's color (a positional swap).
   */
  setPlayerColorAt(slot: number, color: PlayerColor): void {
    const current = this.playerColors();
    if (current[slot]?.id === color.id) return; // nothing to do
    const existingSlot = current.findIndex((c, i) => c.id === color.id && i !== slot);
    const updated = [...current];
    if (existingSlot !== -1) {
      // Swap: displaced slot gets the color that was in the target slot
      updated[existingSlot] = current[slot];
    }
    updated[slot] = color;
    this.playerColors.set(updated);
  }

  /**
   * Sets or toggles the human player color selection.
   */
  setMyPlayerColorId(colorId: PlayerColor['id'] | null): void {
    if (this.myPlayerColorId() === colorId) {
      this.myPlayerColorId.set(null);
    } else {
      this.myPlayerColorId.set(colorId);
    }
  }

  // ── Snapshot export / import ──────────────────────────────────────────────

  /**
   * Serializes the full current game state to a plain JSON object and
   * triggers a browser file download named `catan-snapshot-{timestamp}.json`.
   */
  exportSnapshot(): void {
    const result = this.simulationResult();
    const snapshot = {
      version: 1,
      playerCount: this.playerCount(),
      playerColors: this.playerColors(),
      myPlayerColorId: this.myPlayerColorId(),
      boardVariant: this.boardVariant(),
      desertState: this.desertState(),
      placedSettlements: this.placedSettlements(),
      placedRoads: this.placedRoads(),
      currentTurnIndex: this.currentTurnIndex(),
      boardRotationDeg: this.boardRotationDeg(),
      appPhase: this.appPhase(),
      gameActivePlayerId: this.gameActivePlayerId(),
      longestRoadOwnerId: this.longestRoadOwnerId(),
      simulationResult: result
        ? {
            totalMiniGames: result.totalMiniGames,
            rollCountMap: Array.from(result.rollCountMap.entries()),
            resourceMap: Array.from(result.resourceMap.entries()),
            maxRawScore: result.maxRawScore,
            rankedVertexIds: result.rankedVertexIds,
          }
        : null,
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catan-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Restores game state from a snapshot object parsed from a JSON file.
   * Returns true on success, false if the snapshot structure is invalid.
   *
   * Signal-setting order matters:
   *   1. playerCount  → boardVariant (computed) updates
   *   2. playerColors, myPlayerColorId
   *   3. hexSize      → must be set AFTER boardVariant is stable
   *   4. desertState  → hexes + allVertices recompute
   *   5. placedSettlements, placedRoads, currentTurnIndex, boardRotationDeg
   *   6. simulationResult → scoredVertices can now map vertex IDs → scores
   *   7. gameActivePlayerId
   *   8. appPhase     → set LAST so the UI re-renders with all data in place
   */
  importSnapshot(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false;
    const s = raw as Record<string, unknown>;
    if (s['version'] !== 1) return false;

    try {
      // ── 1. Player count (determines board variant) ─────────────────────
      const count = s['playerCount'];
      if (typeof count === 'number' && [3, 4, 5, 6].includes(count)) {
        this.playerCount.set(count as PlayerCount);
      }

      // ── 2. Player colors ───────────────────────────────────────────────
      if (Array.isArray(s['playerColors']) && s['playerColors'].length > 0) {
        this.playerColors.set(s['playerColors'] as PlayerColor[]);
      }
      this.myPlayerColorId.set(
        (s['myPlayerColorId'] as PlayerColor['id'] | null | undefined) ?? null,
      );

      // ── 3. Hex size (must match the board variant just set) ────────────
      const variant = this.boardVariant();
      if (variant === 'base') {
        this.hexSize.set(computeBaseHexSize(window.innerWidth));
      } else {
        this.hexSize.set(computeHexSize(window.innerWidth));
      }

      // ── 4. Desert state (recomputes hexes + allVertices) ───────────────
      if (s['desertState'] && typeof s['desertState'] === 'object') {
        this.desertState.set(s['desertState'] as DesertState);
      }

      // ── 5. Board actions ───────────────────────────────────────────────
      if (Array.isArray(s['placedSettlements'])) {
        this.placedSettlements.set(s['placedSettlements'] as PlacedSettlement[]);
      }
      if (Array.isArray(s['placedRoads'])) {
        this.placedRoads.set(s['placedRoads'] as PlacedRoad[]);
      }
      if (typeof s['currentTurnIndex'] === 'number') {
        this.currentTurnIndex.set(s['currentTurnIndex']);
      }
      if (typeof s['boardRotationDeg'] === 'number') {
        this.boardRotationDeg.set(s['boardRotationDeg'] as BoardRotationDeg);
      }

      // ── 6. Simulation result ───────────────────────────────────────────
      // resourceMap keys are vertex IDs (strings); these must match the IDs
      // produced by the just-restored hex grid, so desertState must be set first.
      const rawResult = s['simulationResult'] as Record<string, unknown> | null | undefined;
      if (rawResult && typeof rawResult === 'object') {
        const resourceEntries = rawResult['resourceMap'] as [string, number][] | undefined;
        const rollEntries = rawResult['rollCountMap'] as [number, number][] | undefined;

        const resourceMap = new Map<string, number>(resourceEntries ?? []);
        // rollCountMap keys serialise as strings via JSON – coerce back to number
        const rollCountMap = new Map<number, number>(
          (rollEntries ?? []).map(([k, v]) => [Number(k), v]),
        );

        this._simulationResult.set({
          totalMiniGames: (rawResult['totalMiniGames'] as number) ?? 0,
          rollCountMap,
          resourceMap,
          maxRawScore: (rawResult['maxRawScore'] as number) ?? 0,
          rankedVertexIds: (rawResult['rankedVertexIds'] as string[]) ?? [],
        });
      } else {
        this._simulationResult.set(null);
      }

      // ── 7. Game-phase active player ────────────────────────────────────
      const activeId = s['gameActivePlayerId'];
      this.gameActivePlayerId.set(typeof activeId === 'string' ? activeId : null);

      // ── 7.5. Longest road owner ────────────────────────────────────────
      const lrOwnerId = s['longestRoadOwnerId'];
      if (typeof lrOwnerId === 'string') {
        this.longestRoadOwnerId.set(lrOwnerId);
      } else {
        // Fallback for older snapshots
        this.longestRoadOwnerId.set(null);
        this.recalculateLongestRoadOwner();
      }

      // ── 8. Clear transient state ───────────────────────────────────────
      this.undoStack.set([]);
      this.redoStack.set([]);
      this.desertUndoStack.set([]);
      this.desertRedoStack.set([]);
      this.selectedVertexId.set(null);
      this.selectedHexId.set(null);
      this.isSelectingRoad.set(false);
      this.pendingSettlementVertexId.set(null);
      this.currentRoadOptions.set([]);
      this.activeBuildTool.set(null);
      this.panelVisible.set(true);

      // ── 9. Phase (LAST – triggers full UI re-render) ───────────────────
      const phase = s['appPhase'] as AppPhase | undefined;
      if (phase === 'results' || phase === 'game' || phase === 'setup') {
        this.appPhase.set(phase);
      }

      return true;
    } catch {
      return false;
    }
  }
}
