import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';
import { SimulationResult } from '../models/simulation-result.model';
import { DEFAULT_DESERT_POSITIONS, DesertPositions } from '../data/ext-catan-board-layout.data';
import { BoardLayoutService } from './board-layout.service';
import { SimulationService } from './simulation.service';
import {
  computeHexSize,
  deduplicateVertices,
  buildVertexAdjacency,
  computeViewBox,
} from '../../../shared/utils/hex-math.utils';

@Injectable({ providedIn: 'root' })
export class BoardStateStore {
  // Settings
  readonly scoreFormat = signal<'decimal' | 'percentage'>(
    (localStorage.getItem('catan-score-fmt') as 'decimal' | 'percentage') ?? 'decimal',
  );
  readonly showZeroScores = signal<boolean>(localStorage.getItem('catan-show-zeros') !== 'false');

  // Mutable signals
  readonly desertPositions = signal<DesertPositions>({ ...DEFAULT_DESERT_POSITIONS });
  readonly settledVertexIds = signal<string[]>([]);
  readonly undoStack = signal<string[][]>([]);
  readonly redoStack = signal<string[][]>([]);
  readonly selectedVertexId = signal<string | null>(null);
  readonly boardRotationDeg = signal<0 | 90 | 180 | 270>(0);
  readonly isSimulating = signal<boolean>(false);
  readonly hexSize = signal<number>(computeHexSize(window.innerWidth));

  // Simulation result (private writable, public readonly)
  private readonly _simulationResult = signal<SimulationResult | null>(null);
  readonly simulationResult = this._simulationResult.asReadonly();

  // Derived: hex grid
  readonly hexes = computed<HexDefinition[]>(() =>
    this.layoutService.buildHexGrid(this.desertPositions(), this.hexSize()),
  );

  // Derived: vertices (deduplicated with adjacency)
  readonly allVertices = computed<Vertex[]>(() => {
    const hexes = this.hexes();
    const R = this.hexSize();
    const vertices = deduplicateVertices(hexes, R);
    buildVertexAdjacency(vertices, hexes, R);
    return vertices;
  });

  // Derived: scored vertices (with settlement state applied)
  readonly scoredVertices = computed<Vertex[]>(() => {
    const result = this.simulationResult();
    const vertices = this.allVertices();
    const settled = this.settledVertexIds();

    // Create copies with settlement state
    return vertices.map(v => {
      const copy = { ...v };
      copy.isOccupied = settled.includes(v.id);
      copy.isBlocked =
        !copy.isOccupied && v.adjacentVertexIds.some(adjId => settled.includes(adjId));

      if (result) {
        copy.totalResources = result.resourceMap.get(v.id) ?? 0;
        copy.rawScore = copy.totalResources / result.totalRolls;
        copy.normalizedScore = result.maxRawScore > 0 ? copy.rawScore / result.maxRawScore : 0;
      }
      return copy;
    });
  });

  // Re-rank after settlement state changes
  readonly rankedVertices = computed<Vertex[]>(() => {
    const vertices = this.scoredVertices();
    const hexes = this.hexes();
    const hexMap = new Map<string, HexDefinition>();
    for (const h of hexes) {
      hexMap.set(h.id, h);
    }

    // Reset all ranks
    for (const v of vertices) {
      v.rank = null;
    }

    // Rank eligible vertices
    const eligible = vertices
      .filter(
        v =>
          !v.isBlocked &&
          !v.isOccupied &&
          v.adjacentHexIds.some(id => {
            const hex = hexMap.get(id);
            return hex !== undefined && !hex.isDesert;
          }),
      )
      .sort((a, b) => b.rawScore - a.rawScore);

    eligible.forEach((v, i) => {
      v.rank = i + 1;
    });

    return vertices;
  });

  readonly topVertex = computed<Vertex | null>(
    () => this.rankedVertices().find(v => v.rank === 1) ?? null,
  );

  readonly viewBox = computed(() => computeViewBox(this.hexes(), this.hexSize()));

  private readonly layoutService = inject(BoardLayoutService);
  private readonly simService = inject(SimulationService);

  constructor() {
    // Re-run simulation when hexes change
    effect(() => {
      const hexes = this.hexes();
      const vertices = this.allVertices();
      this.isSimulating.set(true);
      setTimeout(() => {
        const result = this.simService.run(hexes, [...vertices.map(v => ({ ...v }))]);
        this._simulationResult.set(result);
        this.isSimulating.set(false);
      }, 0);
    });

    // Persist settings
    effect(() => {
      localStorage.setItem('catan-score-fmt', this.scoreFormat());
    });
    effect(() => {
      localStorage.setItem('catan-show-zeros', String(this.showZeroScores()));
    });
  }

  placeSettlement(vertexId: string): void {
    this.undoStack.update(s => [...s, this.settledVertexIds()]);
    this.redoStack.set([]);
    this.settledVertexIds.update(ids => [...ids, vertexId]);
    this.selectedVertexId.set(null);
  }

  removeSettlement(vertexId: string): void {
    this.undoStack.update(s => [...s, this.settledVertexIds()]);
    this.redoStack.set([]);
    this.settledVertexIds.update(ids => ids.filter(id => id !== vertexId));
  }

  undo(): void {
    const stack = this.undoStack();
    if (!stack.length) return;
    this.redoStack.update(r => [...r, this.settledVertexIds()]);
    this.settledVertexIds.set(stack.at(-1) ?? []);
    this.undoStack.update(s => s.slice(0, -1));
  }

  redo(): void {
    const stack = this.redoStack();
    if (!stack.length) return;
    this.undoStack.update(u => [...u, this.settledVertexIds()]);
    this.settledVertexIds.set(stack.at(-1) ?? []);
    this.redoStack.update(r => r.slice(0, -1));
  }

  updateDesertPosition(desert: 'L1' | 'L2', pos: { row: number; col: number }): void {
    this.desertPositions.update(d => ({ ...d, [desert]: pos }));
    this.settledVertexIds.set([]);
    this.undoStack.set([]);
    this.redoStack.set([]);
  }

  rotateBoard(): void {
    this.boardRotationDeg.update(r => ((r + 90) % 360) as 0 | 90 | 180 | 270);
  }

  selectVertex(id: string | null): void {
    this.selectedVertexId.set(id);
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
