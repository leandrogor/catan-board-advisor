import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { hexPolygonPoints, interpolateHeatmapColor } from '../../../../shared/utils/hex-math.utils';
import { Vertex } from '../../models/vertex.model';
import { HexDefinition } from '../../models/hex.model';
import { RoadOption } from '../../models/road-option.model';
import { PLAYER_COLORS } from '../../models/player-color.model';

/** Ways to roll each dice value (out of 36 total combinations). */
const DICE_WAYS: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly viewBox = computed(() => {
    const vb = this.store.viewBox();
    if (this.store.isSelectingRoad() && this.store.enableAutoZoom()) {
      const pendingId = this.store.pendingSettlementVertexId();
      if (pendingId) {
        const map = this.vertexMap();
        const pt = map.get(pendingId);
        if (pt) {
          const R = this.R();
          const isMobile = window.innerWidth < 1024;

          // Compute zoom dimensions
          // We want the zoom to be tight enough to see options clearly but wide enough to show projections
          const height = R * 7;
          const width = height * (vb.width / vb.height);

          let x = pt.x - width / 2;
          // On mobile, shift the center vertex up to avoid bottom sheet occlusion
          let y = isMobile ? pt.y - height * 0.28 : pt.y - height / 2;

          // Clamp the viewport coordinates to keep the board in view and avoid showing too much sea.
          // Allow a small safety margin of 1.2 * R so that vertices near the edges aren't glued to the absolute border.
          const margin = R * 1.2;
          if (width < vb.width) {
            const minX = vb.x - margin;
            const maxX = vb.x + vb.width - width + margin;
            x = Math.max(minX, Math.min(x, maxX));
          }
          if (height < vb.height) {
            const minY = vb.y - margin;
            const maxY = vb.y + vb.height - height + margin;
            y = Math.max(minY, Math.min(y, maxY));
          }

          return `${x} ${y} ${width} ${height}`;
        }
      }
    }
    return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  });

  protected readonly rotationStyle = computed(
    () => `transform: rotate(${this.store.boardRotationDeg()}deg)`,
  );

  protected readonly R = computed(() => this.store.hexSize());

  protected readonly thresholdRank = computed(() => {
    const vertices = this.store.rankedVertices();
    const eligibleRanks = vertices.map(v => v.rank).filter((r): r is number => r !== null);
    const distinctRanks = Array.from(new Set(eligibleRanks)).sort((a, b) => a - b);
    return distinctRanks.length >= 5 ? distinctRanks[4] : (distinctRanks.at(-1) ?? Infinity);
  });

  protected readonly displayVertices = computed(() => {
    const vertices = this.store.rankedVertices();
    if (this.store.appPhase() === 'game') {
      return vertices.filter(v => v.isOccupied || v.id === this.store.selectedVertexId());
    }
    const showZeros = this.store.showZeroScores();
    if (showZeros) return vertices;

    const threshold = this.thresholdRank();
    return vertices.filter(
      v =>
        v.isOccupied ||
        v.id === this.store.selectedVertexId() ||
        (v.rank !== null && v.rank <= threshold),
    );
  });

  protected readonly validSettlementVertices = computed(() => {
    const spots = this.store.validSettlementSpots();
    const map = this.vertexMap();
    return spots
      .map(id => {
        const pt = map.get(id);
        return { id, pt };
      })
      .filter((s): s is { id: string; pt: { x: number; y: number } } => s.pt !== undefined);
  });

  protected readonly validCityVertices = computed(() => {
    const spots = this.store.validCitySpots();
    const map = this.vertexMap();
    return spots
      .map(id => {
        const pt = map.get(id);
        return { id, pt };
      })
      .filter((s): s is { id: string; pt: { x: number; y: number } } => s.pt !== undefined);
  });

  protected readonly vertexMap = computed(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const v of this.store.allVertices()) {
      map.set(v.id, v.position);
    }
    return map;
  });

  protected readonly placedRoadCoords = computed(() => {
    const map = this.vertexMap();
    const roads = this.store.placedRoads();
    const colorHexMap = new Map<string, string>(PLAYER_COLORS.map(c => [c.id, c.hex]));
    return roads
      .map(r => {
        const p1 = map.get(r.from);
        const p2 = map.get(r.to);
        const colorHex = colorHexMap.get(r.playerColorId) ?? 'var(--color-occupied, #6366f1)';
        return { p1, p2, colorHex };
      })
      .filter(
        (
          r,
        ): r is { p1: { x: number; y: number }; p2: { x: number; y: number }; colorHex: string } =>
          r.p1 !== undefined && r.p2 !== undefined,
      );
  });

  protected readonly suggestedRoadCoords = computed(() => {
    const map = this.vertexMap();
    const suggestions = this.store.myExpansionSuggestions();
    const colorHexMap = new Map<string, string>(PLAYER_COLORS.map(c => [c.id, c.hex]));
    const myColor = this.store.myPlayerColorId();
    const colorHex = myColor
      ? (colorHexMap.get(myColor) ?? 'var(--color-occupied, #6366f1)')
      : 'var(--color-occupied, #6366f1)';

    const roads: {
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      colorHex: string;
    }[] = [];
    for (const s of suggestions) {
      for (const r of s.newRoads) {
        const p1 = map.get(r.from);
        const p2 = map.get(r.to);
        if (p1 && p2) {
          roads.push({ p1, p2, colorHex });
        }
      }
    }
    return roads;
  });

  protected readonly suggestedTargetCoords = computed(() => {
    const map = this.vertexMap();
    const suggestions = this.store.myExpansionSuggestions();
    const colorHexMap = new Map<string, string>(PLAYER_COLORS.map(c => [c.id, c.hex]));
    const myColor = this.store.myPlayerColorId();
    const colorHex = myColor
      ? (colorHexMap.get(myColor) ?? 'var(--color-occupied, #6366f1)')
      : 'var(--color-occupied, #6366f1)';

    return suggestions
      .map(s => {
        const pt = map.get(s.targetVertexId);
        return { id: s.targetVertexId, pt, colorHex };
      })
      .filter(
        (s): s is { id: string; pt: { x: number; y: number }; colorHex: string } =>
          s.pt !== undefined,
      );
  });

  protected readonly activeSelectionOptions = computed(() => {
    if (!this.store.isSelectingRoad()) return [];
    const pendingId = this.store.pendingSettlementVertexId();
    if (!pendingId) return [];

    const map = this.vertexMap();
    const p1 = map.get(pendingId);
    if (!p1) return [];

    return this.store
      .currentRoadOptions()
      .map(opt => {
        const p2 = map.get(opt.toVertexId);
        const pProj = opt.bestProjectedVertexId ? map.get(opt.bestProjectedVertexId) : null;

        const projectionLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
        if (p2) {
          let lastPt = p2;
          for (const stepId of opt.projectionPath) {
            const pt = map.get(stepId);
            if (pt) {
              projectionLines.push({ x1: lastPt.x, y1: lastPt.y, x2: pt.x, y2: pt.y });
              lastPt = pt;
            }
          }
        }

        return {
          opt,
          p1,
          p2,
          pProj,
          projectionLines,
          midpoint: p2 ? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } : null,
        };
      })
      .filter(
        (
          o,
        ): o is {
          opt: RoadOption;
          p1: { x: number; y: number };
          p2: { x: number; y: number };
          pProj: { x: number; y: number } | null;
          projectionLines: { x1: number; y1: number; x2: number; y2: number }[];
          midpoint: { x: number; y: number } | null;
        } => o.p2 !== undefined,
      );
  });

  // ── Drag state (Phase 1 desert drag) ─────────────────────────────────────
  protected readonly draggingDesert = signal<'L1' | 'L2' | null>(null);
  protected readonly ghostWidth = signal<number>(0);
  protected readonly ghostHeight = signal<number>(0);
  protected readonly ghostClientX = signal<number>(0);
  protected readonly ghostClientY = signal<number>(0);
  protected readonly dropTargetHexId = signal<string | null>(null);

  protected readonly ghostHalfWidth = computed(() => this.ghostWidth() / 2);
  protected readonly ghostHalfHeight = computed(() => this.ghostHeight() / 2);

  protected readonly ghostStyle = computed(() => ({
    position: 'fixed',
    left: `${this.ghostClientX() - this.ghostHalfWidth()}px`,
    top: `${this.ghostClientY() - this.ghostHalfHeight()}px`,
    pointerEvents: 'none',
    transform: `rotate(${this.store.boardRotationDeg()}deg)`,
    transformOrigin: 'center center',
    zIndex: '50',
  }));

  private dragPointerId: number | null = null;

  // ── Geometry helpers ──────────────────────────────────────────────────────

  protected getPolygonPoints(hex: HexDefinition): string {
    return hexPolygonPoints(hex.center.x, hex.center.y, this.R());
  }

  /** A4: Font size proportional to dice probability (scaled to range [0.55, 1.0] × base). */
  protected getNumberFontSize(diceNumber: number | null): number {
    const base = this.R() * 0.45;
    if (diceNumber === null) return base;
    const ways = DICE_WAYS[diceNumber] ?? 1;
    // Map ways (1 to 5) to range [0.55, 1.0] to prevent the smallest numbers from being too tiny
    const scale = 0.55 + 0.45 * ((ways - 1) / 4);
    return base * scale;
  }

  /** A5: Counter-rotation transform to keep text upright when board is rotated. */
  protected getTextCounterRotation(cx: number, cy: number): string {
    const deg = this.store.boardRotationDeg();
    if (deg === 0) return '';
    return `rotate(${-deg}, ${cx}, ${cy})`;
  }

  protected getVertexRadius(v: Vertex): number {
    return 4 + 8 * v.normalizedScore;
  }

  protected getVertexFill(v: Vertex): string {
    if (v.isOccupied) {
      const settlement = this.store.placedSettlements().find(s => s.vertexId === v.id);
      if (settlement) {
        const colorDef = PLAYER_COLORS.find(c => c.id === settlement.playerColorId);
        if (colorDef) return colorDef.hex;
      }
      return 'var(--color-occupied)';
    }
    if (v.isBlocked) return 'var(--color-blocked)';
    return interpolateHeatmapColor(v.normalizedScore);
  }

  protected getVertexOpacity(v: Vertex): number {
    if (v.isBlocked) return 0.35;
    return 1;
  }

  protected isHotNumber(n: number | null): boolean {
    return n === 6 || n === 8;
  }

  protected getVertexAriaLabel(v: Vertex): string {
    const rankText = v.rank ? `Rank ${v.rank}` : 'Unranked';
    return `Vertex ${rankText}, score ${v.rawScore.toFixed(3)}`;
  }

  /** Phase 1: what text to show on a non-desert hex. */
  protected getHexPhase1Label(hex: HexDefinition): string {
    if (this.store.showNumbersInSetup()) {
      // Show dice number
      return hex.diceNumber === null ? '—' : String(hex.diceNumber);
    }
    // Show spiral letter
    const posKey = `${hex.row}-${hex.col}`;
    return this.store.spiralLetterAssignment().get(posKey) ?? hex.letter;
  }

  // ── Click handlers ────────────────────────────────────────────────────────

  protected onVertexClick(v: Vertex): void {
    if (this.store.appPhase() === 'game' && this.store.activeBuildTool()) return;
    if (v.isBlocked) return;

    const wasSelectingRoad = this.store.isSelectingRoad();
    const wasSelected = this.store.selectedVertexId();

    if (wasSelectingRoad || wasSelected !== null) {
      // cancel the current state exactly as in (a)
      this.store.isSelectingRoad.set(false);
      this.store.pendingSettlementVertexId.set(null);
      this.store.currentRoadOptions.set([]);
      this.store.selectedVertexId.set(null);

      // then if it's a different vertex, open it
      if (wasSelected !== v.id) {
        this.store.selectVertex(v.id);
        this.scrollToVertex(v.id);
      }
    } else {
      this.store.selectVertex(v.id);
      this.scrollToVertex(v.id);
    }
  }

  private scrollToVertex(vertexId: string): void {
    setTimeout(() => {
      const vertexEl = document.getElementById(vertexId);
      if (!vertexEl) return;

      const rect = vertexEl.getBoundingClientRect();
      const absoluteX = rect.left + rect.width / 2 + window.scrollX;
      const absoluteY = rect.top + rect.height / 2 + window.scrollY;

      const isMobile = window.innerWidth < 1024;
      let offset = 0;
      if (isMobile) {
        const panelEl =
          document.querySelector('app-vertex-detail-panel') ||
          document.querySelector('.fixed.bottom-0');
        const panelHeight = panelEl ? (panelEl as HTMLElement).offsetHeight : 280;
        offset = panelHeight / 2;
      }

      const targetX = absoluteX - window.innerWidth / 2;
      const targetY = absoluteY - window.innerHeight / 2 + offset;

      window.scrollTo({
        left: targetX,
        top: targetY,
        behavior: 'smooth',
      });
    }, 100);
  }

  protected onHexClick(hex: HexDefinition): void {
    if (this.store.appPhase() === 'game' && this.store.activeBuildTool()) return;
    if (hex.isDesert) return; // Deserts are drag handles, not click targets
    if (this.store.appPhase() === 'setup') {
      this.store.toggleHexDisplay();
    } else {
      this.store.selectHex(this.store.selectedHexId() === hex.id ? null : hex.id);
    }
  }

  protected onBuildSpotClick(spotId: string): void {
    const tool = this.store.activeBuildTool();
    if (tool === 'settlement') {
      this.store.buildSettlement(spotId);
    } else if (tool === 'city') {
      this.store.upgradeToCity(spotId);
    }
  }

  protected onRoadEdgeClick(fromId: string, toId: string): void {
    this.store.buildRoad(fromId, toId);
  }

  protected isSelected(v: Vertex): boolean {
    return this.store.selectedVertexId() === v.id;
  }

  protected isTopVertex(v: Vertex): boolean {
    return v.rank === 1;
  }

  protected isDropTarget(hexId: string): boolean {
    return this.dropTargetHexId() === hexId;
  }

  // ── Drag & Drop (Phase 1, Pointer Events API) ─────────────────────────────

  protected onDesertPointerDown(event: PointerEvent, desert: 'L1' | 'L2'): void {
    if (this.store.appPhase() !== 'setup') return;
    event.preventDefault();
    event.stopPropagation();

    this.draggingDesert.set(desert);
    this.dragPointerId = event.pointerId;

    const targetEl = event.currentTarget as SVGElement | null;
    if (targetEl) {
      targetEl.setPointerCapture(event.pointerId);
      const rect = targetEl.getBoundingClientRect();
      this.ghostWidth.set(rect.width);
      this.ghostHeight.set(rect.height);
    }

    this.ghostClientX.set(event.clientX);
    this.ghostClientY.set(event.clientY);
  }

  @HostListener('document:pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.draggingDesert() === null || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();

    this.ghostClientX.set(event.clientX);
    this.ghostClientY.set(event.clientY);

    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const hexEl = elements.find(el => (el as HTMLElement).dataset?.['hexId']);
    const targetHexId = hexEl ? (hexEl as HTMLElement).dataset['hexId'] : null;

    if (targetHexId) {
      const dragging = this.draggingDesert();
      const ds = this.store.desertState();

      const myPos = dragging === 'L2' && ds.variant === 'ext' ? ds.L2 : ds.L1;
      const myKey = myPos ? `hex-${myPos.row}-${myPos.col}` : null;

      // In ext mode, also block dropping on the other desert's current hex
      let otherKey: string | null = null;
      if (ds.variant === 'ext' && dragging) {
        const otherDesert = dragging === 'L1' ? 'L2' : 'L1';
        const otherPos = ds[otherDesert];
        otherKey = `hex-${otherPos.row}-${otherPos.col}`;
      }

      if (targetHexId === otherKey || targetHexId === myKey) {
        this.dropTargetHexId.set(null);
      } else {
        this.dropTargetHexId.set(targetHexId);
      }
    } else {
      this.dropTargetHexId.set(null);
    }
  }

  @HostListener('document:pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (this.draggingDesert() === null || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();

    const elements = document.elementsFromPoint(event.clientX, event.clientY);
    const hexEl = elements.find(el => (el as HTMLElement).dataset?.['hexId']);
    const targetHexId = hexEl ? (hexEl as HTMLElement).dataset['hexId'] : null;

    const desert = this.draggingDesert();
    if (desert && targetHexId) {
      const ds = this.store.desertState();

      // In ext mode, don't allow dropping on the other desert's current position
      let otherKey: string | null = null;
      if (ds.variant === 'ext') {
        const otherDesert = desert === 'L1' ? 'L2' : 'L1';
        const otherPos = ds[otherDesert];
        otherKey = `hex-${otherPos.row}-${otherPos.col}`;
      }

      if (targetHexId !== otherKey) {
        // Parse row/col from hex id: "hex-{row}-{col}"
        const parts = targetHexId.split('-');
        const row = Number.parseInt(parts[1], 10);
        const col = Number.parseInt(parts[2], 10);
        this.store.updateDesertPosition(desert, { row, col });
      }
    }

    this.draggingDesert.set(null);
    this.dropTargetHexId.set(null);
    this.dragPointerId = null;
  }

  @HostListener('document:pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.draggingDesert.set(null);
    this.dropTargetHexId.set(null);
    this.dragPointerId = null;
  }
}
