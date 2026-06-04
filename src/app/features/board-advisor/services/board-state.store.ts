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
import { DEFAULT_DESERT_POSITIONS, DesertPositions } from '../data/ext-catan-board-layout.data';
import { BoardLayoutService } from './board-layout.service';
import { SimulationService } from './simulation.service';
import {
  assignSpiralLetters,
  computeHexSize,
  deduplicateVertices,
  buildVertexAdjacency,
  computeViewBox,
} from '../../../shared/utils/hex-math.utils';

export type AppPhase = 'setup' | 'results';

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
  readonly playerCount = signal<5 | 6>(5);
  readonly playerColors = signal<PlayerColor[]>(PLAYER_COLORS.slice(0, 5));
  readonly myPlayerColorId = signal<PlayerColor['id'] | null>(null);

  // ── Board state ─────────────────────────────────────────────────────────────
  readonly desertPositions = signal<DesertPositions>({ ...DEFAULT_DESERT_POSITIONS });
  readonly placedSettlements = signal<PlacedSettlement[]>([]);
  readonly placedRoads = signal<PlacedRoad[]>([]);
  readonly undoStack = signal<ActionSnapshot[]>([]);
  readonly redoStack = signal<ActionSnapshot[]>([]);
  readonly desertUndoStack = signal<DesertPositions[]>([]);
  readonly desertRedoStack = signal<DesertPositions[]>([]);
  readonly selectedVertexId = signal<string | null>(null);
  readonly selectedHexId = signal<string | null>(null);
  readonly boardRotationDeg = signal<0 | 90 | 180 | 270>(0);
  readonly isSimulating = signal<boolean>(false);
  readonly hexSize = signal<number>(computeHexSize(window.innerWidth));

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

  readonly currentPlayerColor = computed<PlayerColor | null>(
    () => this.turnSequence()[this.currentTurnIndex()] ?? null,
  );

  readonly totalTurns = computed<number>(() => this.playerCount() * 2);

  readonly isSetupComplete = computed<boolean>(() => this.currentTurnIndex() >= this.totalTurns());

  // ── Simulation result (private writable, public readonly) ───────────────────
  private readonly _simulationResult = signal<SimulationResult | null>(null);
  readonly simulationResult = this._simulationResult.asReadonly();

  // ── Computed: hex grid ───────────────────────────────────────────────────────
  readonly hexes = computed<HexDefinition[]>(() =>
    this.layoutService.buildHexGrid(this.desertPositions(), this.hexSize()),
  );

  /** Maps `"${row}-${col}"` → assigned spiral letter (for Phase 1 display). */
  readonly spiralLetterAssignment = computed<ReadonlyMap<string, string>>(() =>
    assignSpiralLetters(this.desertPositions()),
  );

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
        copy.totalResources = copy.rawScore * SimulationService.ROLLS_PER_GAME;
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

  readonly myExpansionSuggestions = computed(() => {
    const myColor = this.myPlayerColorId();
    if (!myColor || this.appPhase() !== 'results') {
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
    setTimeout(() => {
      const result = this.simService.run(hexes, [...vertices.map(v => ({ ...v }))]);
      this._simulationResult.set(result);
      this.isSimulating.set(false);
      this.appPhase.set('results');
    }, 0);
  }

  /**
   * Resets everything to initial state: clears simulation, settlements, roads,
   * turn tracking, player config, undo/redo stacks, and returns to Phase 1.
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
    this.playerCount.set(5);
    this.playerColors.set(PLAYER_COLORS.slice(0, 5));
    this.myPlayerColorId.set(null);
    this.appPhase.set('setup');
  }

  placeSettlement(vertexId: string): void {
    const colorId = this.currentPlayerColor()?.id ?? 'red';
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list => [...list, { vertexId, playerColorId: colorId }]);
    this.selectedVertexId.set(null);
  }

  removeSettlement(vertexId: string): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.placedSettlements(),
        roads: this.placedRoads(),
        turnIndex: this.currentTurnIndex(),
      },
    ]);
    this.redoStack.set([]);
    this.placedSettlements.update(list => list.filter(s => s.vertexId !== vertexId));
    this.placedRoads.update(roads => roads.filter(r => r.from !== vertexId && r.to !== vertexId));
  }

  undo(): void {
    if (this.appPhase() === 'setup') {
      const stack = this.desertUndoStack();
      if (!stack.length) return;
      this.desertRedoStack.update(r => [...r, { ...this.desertPositions() }]);
      this.desertPositions.set(stack.at(-1)!);
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
        },
      ]);
      const last = stack.at(-1)!;
      this.placedSettlements.set(last.settled);
      this.placedRoads.set(last.roads);
      this.currentTurnIndex.set(last.turnIndex);
      this.undoStack.update(s => s.slice(0, -1));
    }
  }

  redo(): void {
    if (this.appPhase() === 'setup') {
      const stack = this.desertRedoStack();
      if (!stack.length) return;
      this.desertUndoStack.update(u => [...u, { ...this.desertPositions() }]);
      this.desertPositions.set(stack.at(-1)!);
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
        },
      ]);
      const last = stack.at(-1)!;
      this.placedSettlements.set(last.settled);
      this.placedRoads.set(last.roads);
      this.currentTurnIndex.set(last.turnIndex);
      this.redoStack.update(r => r.slice(0, -1));
    }
  }

  /**
   * Moves a desert to a target position.
   * If the target is occupied by the other desert, the two deserts swap.
   * Resets settled vertices and undo/redo when deserts change.
   */
  updateDesertPosition(desert: 'L1' | 'L2', pos: { row: number; col: number }): void {
    const current = this.desertPositions();
    const other = desert === 'L1' ? 'L2' : 'L1';
    const otherPos = current[other];

    const myCurrentPos = current[desert];
    if (myCurrentPos.row === pos.row && myCurrentPos.col === pos.col) {
      return;
    }

    this.desertUndoStack.update(s => [...s, { ...current }]);
    this.desertRedoStack.set([]);

    // If dropping on the other desert's position, swap them
    if (otherPos.row === pos.row && otherPos.col === pos.col) {
      const next: DesertPositions =
        desert === 'L1' ? { L1: pos, L2: myCurrentPos } : { L1: myCurrentPos, L2: pos };
      this.desertPositions.set(next);
    } else {
      this.desertPositions.update(d => ({ ...d, [desert]: pos }));
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
      },
    ]);
    this.redoStack.set([]);

    this.placedSettlements.update(list => [...list, { vertexId: fromId, playerColorId: colorId }]);
    this.placedRoads.update(roads => [
      ...roads,
      { from: fromId, to: toVertexId, playerColorId: colorId },
    ]);

    this.currentTurnIndex.update(i => i + 1);

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
    this.boardRotationDeg.update(r => ((r + 90) % 360) as 0 | 90 | 180 | 270);
  }

  selectVertex(id: string | null): void {
    this.selectedVertexId.set(id);
    if (id !== null) this.selectedHexId.set(null);
  }

  updateHexSize(viewportWidth: number): void {
    this.hexSize.set(computeHexSize(viewportWidth));
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
   * Changes the player count. Adjusts playerColors to match:
   * - 5 → 6: appends the first unused color (default: chocolate).
   * - 6 → 5: drops the last slot.
   */
  setPlayerCount(count: 5 | 6): void {
    if (count === this.playerCount()) return;
    this.playerCount.set(count);
    if (count === 6) {
      const current = this.playerColors();
      const usedIds = new Set(current.map(c => c.id));
      const unused = PLAYER_COLORS.find(c => !usedIds.has(c.id));
      this.playerColors.set([...current, unused ?? PLAYER_COLORS[5]]);
    } else {
      this.playerColors.update(list => list.slice(0, 5));
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
}
