import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { SimulationResult } from '../models/simulation-result.model';
import { RoadOption, ActionSnapshot } from '../models/road-option.model';
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

  // ── Phase ───────────────────────────────────────────────────────────────────
  /** Current app phase: 'setup' shows letters+drag UI; 'results' shows heatmap. */
  readonly appPhase = signal<AppPhase>('setup');

  // ── Board state ─────────────────────────────────────────────────────────────
  readonly desertPositions = signal<DesertPositions>({ ...DEFAULT_DESERT_POSITIONS });
  readonly settledVertexIds = signal<string[]>([]);
  readonly placedRoads = signal<{ from: string; to: string }[]>([]);
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
   * Resets to Phase 1 (setup). Clears simulation results, settlements,
   * undo/redo stacks, and hex display overrides. Keeps current desert positions.
   */
  resetToSetup(): void {
    this._simulationResult.set(null);
    this.settledVertexIds.set([]);
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
    this.appPhase.set('setup');
  }

  placeSettlement(vertexId: string): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.settledVertexIds(),
        roads: this.placedRoads(),
      },
    ]);
    this.redoStack.set([]);
    this.settledVertexIds.update(ids => [...ids, vertexId]);
    this.selectedVertexId.set(null);
  }

  removeSettlement(vertexId: string): void {
    this.undoStack.update(s => [
      ...s,
      {
        settled: this.settledVertexIds(),
        roads: this.placedRoads(),
      },
    ]);
    this.redoStack.set([]);
    this.settledVertexIds.update(ids => ids.filter(id => id !== vertexId));
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
          settled: this.settledVertexIds(),
          roads: this.placedRoads(),
        },
      ]);
      const last = stack.at(-1)!;
      this.settledVertexIds.set(last.settled);
      this.placedRoads.set(last.roads);
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
          settled: this.settledVertexIds(),
          roads: this.placedRoads(),
        },
      ]);
      const last = stack.at(-1)!;
      this.settledVertexIds.set(last.settled);
      this.placedRoads.set(last.roads);
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

    this.settledVertexIds.set([]);
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
  }

  cancelRoadSelection(): void {
    this.isSelectingRoad.set(false);
    this.pendingSettlementVertexId.set(null);
    this.currentRoadOptions.set([]);
  }

  confirmRoadSelection(toVertexId: string): void {
    const fromId = this.pendingSettlementVertexId();
    if (!fromId) return;

    this.undoStack.update(s => [
      ...s,
      {
        settled: this.settledVertexIds(),
        roads: this.placedRoads(),
      },
    ]);
    this.redoStack.set([]);

    this.settledVertexIds.update(ids => [...ids, fromId]);
    this.placedRoads.update(roads => [...roads, { from: fromId, to: toVertexId }]);

    this.isSelectingRoad.set(false);
    this.pendingSettlementVertexId.set(null);
    this.currentRoadOptions.set([]);
    this.selectedVertexId.set(null);
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
}
