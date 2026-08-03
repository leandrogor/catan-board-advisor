import { Component, inject, computed, signal, HostListener, NgZone } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { hexPolygonPoints, interpolateHeatmapColor } from '../../../../shared/utils/hex-math.utils';
import { Vertex } from '../../models/vertex.model';
import { HexDefinition } from '../../models/hex.model';
import { RoadOption } from '../../models/road-option.model';
import { PLAYER_COLORS, getPlayerDisplayColor } from '../../models/player-color.model';
import { ThemeService } from '../../../../core/services/theme.service';

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
  protected readonly themeService = inject(ThemeService);
  protected readonly ngZone = inject(NgZone);

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

  protected readonly suggestedTargetIds = computed(() => {
    return new Set(this.store.myExpansionSuggestions().map(s => s.targetVertexId));
  });

  protected readonly displayVertices = computed(() => {
    const vertices = this.store.rankedVertices();

    if (this.store.appPhase() === 'setup' || !this.store.simulationResult()) {
      return vertices.filter(v => !v.isBlocked || v.isOccupied);
    }

    const showZeros = this.store.showZeroScores();
    return vertices.filter(v => {
      if (v.isOccupied) return true;
      if (v.isBlocked) return false;
      if (v.id === this.store.selectedVertexId()) return true;

      if (!showZeros && (v.rawScore ?? 0) <= 0) {
        return false;
      }
      return true;
    });
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

  protected readonly longestRoadTrackKey = computed(() => {
    const lr = this.store.longestRoadDetails();
    if (!lr) return '';
    const edgeKeys = lr.path.map(r => (r.from < r.to ? `${r.from}_${r.to}` : `${r.to}_${r.from}`));
    return `${lr.ownerId}_${lr.length}_${edgeKeys.join('-')}`;
  });

  protected readonly longestRoadHighlightCoords = computed(() => {
    const map = this.vertexMap();
    const lrDetails = this.store.longestRoadDetails();
    if (!lrDetails || lrDetails.length < 5) return [];

    const ownerColor = this.store.playerColors().find(c => c.id === lrDetails.ownerId);
    const colorHex = ownerColor?.hex ?? '#fbbf24';

    return lrDetails.path
      .map(r => {
        const p1 = map.get(r.from);
        const p2 = map.get(r.to);
        return { p1, p2, colorHex };
      })
      .filter(
        (
          r,
        ): r is { p1: { x: number; y: number }; p2: { x: number; y: number }; colorHex: string } =>
          r.p1 !== undefined && r.p2 !== undefined,
      );
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
        const glowColor = this.getPlayerGlowColor(r.playerColorId);
        return { p1, p2, colorHex, glowColor };
      })
      .filter(
        (
          r,
        ): r is {
          p1: { x: number; y: number };
          p2: { x: number; y: number };
          colorHex: string;
          glowColor: string;
        } => r.p1 !== undefined && r.p2 !== undefined,
      );
  });

  protected readonly suggestedRoadCoords = computed(() => {
    const map = this.vertexMap();
    const suggestions = this.store.myExpansionSuggestions();
    const isDark = this.themeService.isDark();

    const roads: {
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      colorHex: string;
      rank: 1 | 2;
    }[] = [];
    for (const s of suggestions) {
      const sColorHex = getPlayerDisplayColor(s.playerColorId, isDark);
      for (const r of s.newRoads) {
        if (this.store.hasRoadOnEdge(r.from, r.to)) continue;
        const p1 = map.get(r.from);
        const p2 = map.get(r.to);
        if (p1 && p2) {
          roads.push({ p1, p2, colorHex: sColorHex, rank: s.rank });
        }
      }
    }
    return roads;
  });

  protected readonly suggestedTargetCoords = computed(() => {
    const map = this.vertexMap();
    const suggestions = this.store.myExpansionSuggestions();
    const isDark = this.themeService.isDark();

    const result: { id: string; pt: { x: number; y: number }; colorHex: string; rank: 1 | 2 }[] =
      [];
    const seenIds = new Set<string>();

    for (const s of suggestions) {
      if (seenIds.has(s.targetVertexId)) continue;
      seenIds.add(s.targetVertexId);
      const pt = map.get(s.targetVertexId);
      if (pt) {
        const sColorHex = getPlayerDisplayColor(s.playerColorId, isDark);
        result.push({ id: s.targetVertexId, pt, colorHex: sColorHex, rank: s.rank });
      }
    }
    return result;
  });

  protected readonly canUndo = computed(() => {
    if (this.store.appPhase() === 'setup') {
      return this.store.desertUndoStack().length > 0;
    }
    return this.store.undoStack().length > 0;
  });

  protected readonly canRedo = computed(() => {
    if (this.store.appPhase() === 'setup') {
      return this.store.desertRedoStack().length > 0;
    }
    return this.store.redoStack().length > 0;
  });

  protected readonly gestureToast = signal<{
    action: 'undo' | 'redo';
    count: number;
    id: number;
  } | null>(null);
  private gestureToastTimeout: ReturnType<typeof setTimeout> | null = null;

  private twoFingerState: {
    active: boolean;
    disqualified: boolean;
    startX: number;
    startY: number;
    startDist: number;
    startTime: number;
    lastDeltaX: number;
  } | null = null;

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

  // ── Hold-to-Act state (Phase 2/3 Mobile 1s long-press) ─────────────────────
  protected readonly holdingVertexId = signal<string | null>(null);
  protected readonly holdingEdgeKey = signal<string | null>(null);
  protected readonly holdProgress = signal<number>(0);
  protected readonly edgeHoldProgress = signal<number>(0);
  protected readonly holdActionType = signal<'city' | 'settlement' | null>(null);

  protected readonly interactiveRoadEdges = computed<
    {
      from: string;
      to: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      p1Trimmed: { x: number; y: number };
      p2Trimmed: { x: number; y: number };
      midpoint: { x: number; y: number };
      builders: {
        colorId: string;
        colorHex: string;
        name: string;
        startVertexId: string;
      }[];
    }[]
  >(() => {
    if (this.store.gameWinner()) return [];
    if (this.store.appPhase() !== 'game') return [];

    const vertices = this.store.allVertices();
    const vertexMap = new Map<string, Vertex>();
    for (const v of vertices) {
      vertexMap.set(v.id, v);
    }

    const edges: {
      from: string;
      to: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      p1Trimmed: { x: number; y: number };
      p2Trimmed: { x: number; y: number };
      midpoint: { x: number; y: number };
      builders: {
        colorId: string;
        colorHex: string;
        name: string;
        startVertexId: string;
      }[];
    }[] = [];

    const addedKeys = new Set<string>();

    for (const v1 of vertices) {
      for (const adjId of v1.adjacentVertexIds) {
        const key = v1.id < adjId ? `${v1.id}_${adjId}` : `${adjId}_${v1.id}`;
        if (addedKeys.has(key)) continue;

        const v2 = vertexMap.get(adjId);
        if (!v2) continue;

        const rawBuilders = this.store.getAvailableRoadBuildersForEdge(v1.id, v2.id);
        if (rawBuilders.length === 0) continue;

        addedKeys.add(key);

        const builders = rawBuilders.map(b => {
          const isV1Valid = this.store.isValidRoadStart(v1.id, b.colorId);
          const isV2Valid = this.store.isValidRoadStart(v2.id, b.colorId);
          let startVertexId = v1.id;
          if (isV1Valid) {
            startVertexId = v1.id;
          } else if (isV2Valid) {
            startVertexId = v2.id;
          }
          return {
            ...b,
            startVertexId,
          };
        });

        const trimmed = this.getTrimmedEdgePoints(v1.position, v2.position, 15);

        edges.push({
          from: v1.id,
          to: v2.id,
          p1: v1.position,
          p2: v2.position,
          p1Trimmed: trimmed.p1Trimmed,
          p2Trimmed: trimmed.p2Trimmed,
          midpoint: {
            x: (v1.position.x + v2.position.x) / 2,
            y: (v1.position.y + v2.position.y) / 2,
          },
          builders,
        });
      }
    }
    return edges;
  });

  private getTrimmedEdgePoints(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    insetPx = 15,
  ): {
    p1Trimmed: { x: number; y: number };
    p2Trimmed: { x: number; y: number };
  } {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { p1Trimmed: p1, p2Trimmed: p2 };

    const tInset = Math.min(0.35, insetPx / len);
    return {
      p1Trimmed: {
        x: p1.x + dx * tInset,
        y: p1.y + dy * tInset,
      },
      p2Trimmed: {
        x: p2.x - dx * tInset,
        y: p2.y - dy * tInset,
      },
    };
  }

  protected getHoldLineSegments(
    edge: {
      from: string;
      to: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      p1Trimmed: { x: number; y: number };
      p2Trimmed: { x: number; y: number };
      midpoint: { x: number; y: number };
      builders: {
        colorId: string;
        colorHex: string;
        name: string;
        startVertexId: string;
      }[];
    },
    progress: number,
  ): { x1: number; y1: number; x2: number; y2: number; colorHex: string }[] {
    if (progress <= 0 || edge.builders.length === 0) return [];

    const b1 = edge.builders[0];
    const b2 = edge.builders[1];

    if (edge.builders.length >= 2 && b1 && b2 && b1.startVertexId !== b2.startVertexId) {
      // Dual Converging Lines!
      const pStart1 = b1.startVertexId === edge.from ? edge.p1Trimmed : edge.p2Trimmed;
      const pStart2 = b2.startVertexId === edge.from ? edge.p1Trimmed : edge.p2Trimmed;
      const M = edge.midpoint;

      const end1 = {
        x: pStart1.x + (M.x - pStart1.x) * progress,
        y: pStart1.y + (M.y - pStart1.y) * progress,
      };
      const end2 = {
        x: pStart2.x + (M.x - pStart2.x) * progress,
        y: pStart2.y + (M.y - pStart2.y) * progress,
      };

      return [
        { x1: pStart1.x, y1: pStart1.y, x2: end1.x, y2: end1.y, colorHex: b1.colorHex },
        { x1: pStart2.x, y1: pStart2.y, x2: end2.x, y2: end2.y, colorHex: b2.colorHex },
      ];
    } else {
      // Single Builder (or both starting at same vertex)
      const primary = edge.builders[0];
      const pStart = primary.startVertexId === edge.from ? edge.p1Trimmed : edge.p2Trimmed;
      const pEnd = primary.startVertexId === edge.from ? edge.p2Trimmed : edge.p1Trimmed;

      const currentEnd = {
        x: pStart.x + (pEnd.x - pStart.x) * progress,
        y: pStart.y + (pEnd.y - pStart.y) * progress,
      };

      return [
        {
          x1: pStart.x,
          y1: pStart.y,
          x2: currentEnd.x,
          y2: currentEnd.y,
          colorHex: primary.colorHex,
        },
      ];
    }
  }

  private holdAnimFrame: number | null = null;
  private holdStartTime = 0;
  private holdPointerStartPos: { x: number; y: number } | null = null;
  private isHoldCompleted = false;

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

  /**
   * Returns two rows of LED dot positions for the runway-light animation
   * along the road segment from p1 to p2.
   * Each dot has: x, y, index (for animation-delay staggering), and rowSign (+1 / -1).
   */
  protected getRoadLights(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ): { x: number; y: number; index: number; rowSign: number }[] {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return [];

    // Unit vector along the segment
    const ux = dx / len;
    const uy = dy / len;

    // Perpendicular unit vector (rotated 90°)
    const px = -uy;
    const py = ux;

    // Side offset in SVG units: close to the edge line
    const sideOffset = 2;

    // One dot every ~8 SVG units, minimum 6 so short edges always look full
    const dotCount = Math.max(6, Math.round(len / 8));
    const step = len / (dotCount + 1);

    const dots: { x: number; y: number; index: number; rowSign: number }[] = [];

    for (let i = 1; i <= dotCount; i++) {
      const t = i * step;
      const cx = p1.x + ux * t;
      const cy = p1.y + uy * t;

      // Push both top and bottom row dots in a single call to avoid duplicate push calls
      dots.push(
        {
          x: cx + px * sideOffset,
          y: cy + py * sideOffset,
          index: i - 1,
          rowSign: 1,
        },
        {
          x: cx - px * sideOffset,
          y: cy - py * sideOffset,
          index: i - 1,
          rowSign: -1,
        },
      );
    }

    return dots;
  }

  protected getRunwayColor(colorId: string): string {
    return getPlayerDisplayColor(colorId, this.themeService.isDark());
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

  protected getPlayerGlowColor(colorId: string): string {
    switch (colorId) {
      case 'blue':
        return '#3b82f6'; // Electric blue glow
      case 'green':
        return '#10b981'; // Emerald green glow
      case 'red':
        return '#ef4444'; // Bright crimson glow
      case 'mustard':
        return '#f59e0b'; // Gold glow
      case 'chocolate':
        return '#f97316'; // Orange/brown glow
      case 'cream':
        return '#fef08a'; // Soft cream glow
      default:
        return '#6366f1';
    }
  }

  protected getVertexGlowColor(v: Vertex): string | null {
    if (!v.isOccupied) return null;
    const settlement = this.store.placedSettlements().find(s => s.vertexId === v.id);
    if (!settlement) return null;
    return this.getPlayerGlowColor(settlement.playerColorId);
  }

  protected getVertexOpacity(v: Vertex): number {
    if (v.isBlocked) return 0.35;
    if (
      this.store.appPhase() === 'game' &&
      !v.isOccupied &&
      v.id !== this.store.selectedVertexId() &&
      !this.suggestedTargetIds().has(v.id)
    ) {
      return 0.35;
    }
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

  // ── Click & Hold handlers ──────────────────────────────────────────────────

  protected getVertexTouchRadius(v: Vertex): number {
    return Math.max(22, this.getVertexRadius(v) + 8);
  }

  protected getAvailableBuilderColors(
    v: Vertex,
  ): { colorId: string; colorHex: string; name: string }[] {
    if (this.store.gameWinner()) return [];
    if (v.isOccupied || v.isBlocked) return [];

    if (!this.store.isSetupComplete()) {
      const active = this.store.currentPlayerColor();
      if (!active) return [];
      return [
        {
          colorId: active.id,
          colorHex: getPlayerDisplayColor(active.id, this.themeService.isDark()),
          name: this.store.getPlayerName(active.id),
        },
      ];
    }

    const isDark = this.themeService.isDark();
    const result: { colorId: string; colorHex: string; name: string }[] = [];

    for (const p of this.store.playerColors()) {
      if (this.store.hasRoadConnected(v.id, p.id)) {
        const counts = this.store.getPlayerPieceCounts(p.id);
        if (counts.settlements < 5) {
          result.push({
            colorId: p.id,
            colorHex: getPlayerDisplayColor(p.id, isDark),
            name: this.store.getPlayerName(p.id),
          });
        }
      }
    }
    return result;
  }

  protected getHoldActionType(v: Vertex): {
    action: 'city' | 'settlement';
    colors: { colorId: string; colorHex: string; name: string }[];
  } | null {
    if (this.store.gameWinner()) return null;
    if (this.store.isSelectingRoad()) return null;

    if (v.isOccupied) {
      const s = this.store.getSettlementAt(v.id);
      if (s?.type === 'settlement') {
        const counts = this.store.getPlayerPieceCounts(s.playerColorId);
        if (counts.cities < 4) {
          return {
            action: 'city',
            colors: [{ colorId: s.playerColorId, colorHex: '', name: '' }],
          };
        }
      }
      return null;
    }

    const builders = this.getAvailableBuilderColors(v);
    if (builders.length > 0) {
      return { action: 'settlement', colors: builders };
    }
    return null;
  }

  protected onVertexPointerDown(event: PointerEvent, v: Vertex): void {
    const holdInfo = this.getHoldActionType(v);
    if (!holdInfo) return;

    if (event.cancelable) {
      event.preventDefault();
    }
    const target = event.currentTarget as HTMLElement | SVGElement | null;
    try {
      (target as Element)?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore pointer capture errors on unsupported devices
    }

    this.isHoldCompleted = false;
    this.holdingVertexId.set(v.id);
    this.holdActionType.set(holdInfo.action);
    this.holdProgress.set(0);
    this.holdStartTime = performance.now();
    this.holdPointerStartPos = { x: event.clientX, y: event.clientY };

    const DURATION = 1000;
    const animate = (now: number) => {
      if (this.holdingVertexId() !== v.id) return;
      const elapsed = now - this.holdStartTime;
      const progress = Math.min(1, elapsed / DURATION);

      this.ngZone.run(() => {
        this.holdProgress.set(progress);
      });

      if (progress >= 1) {
        this.isHoldCompleted = true;
        this.ngZone.run(() => {
          this.executeHoldAction(v.id, holdInfo.action, holdInfo.colors);
          this.cancelHold();
        });
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch {
            // Ignore haptic vibration errors on unsupported devices
          }
        }
        return;
      }
      this.holdAnimFrame = requestAnimationFrame(animate);
    };
    this.holdAnimFrame = requestAnimationFrame(animate);
  }

  protected onVertexPointerMove(event: PointerEvent): void {
    if (!this.holdingVertexId() || !this.holdPointerStartPos) return;
    const dist = Math.hypot(
      event.clientX - this.holdPointerStartPos.x,
      event.clientY - this.holdPointerStartPos.y,
    );
    if (dist > 14) {
      this.cancelHold();
    }
  }

  protected onVertexPointerUp(): void {
    this.cancelHold();
  }

  protected onVertexPointerCancel(): void {
    this.cancelHold();
  }

  protected onVertexPointerLeave(): void {
    this.cancelHold();
  }

  private cancelHold(): void {
    if (this.holdAnimFrame !== null) {
      cancelAnimationFrame(this.holdAnimFrame);
      this.holdAnimFrame = null;
    }
    this.holdingVertexId.set(null);
    this.holdingEdgeKey.set(null);
    this.holdProgress.set(0);
    this.edgeHoldProgress.set(0);
    this.holdActionType.set(null);
    this.holdPointerStartPos = null;
  }

  private executeHoldAction(
    vertexId: string,
    action: 'city' | 'settlement',
    colors: { colorId: string; colorHex: string; name: string }[],
  ): void {
    if (action === 'city') {
      this.store.upgradeToCity(vertexId);
    } else if (action === 'settlement') {
      if (colors.length === 1) {
        const colorId = colors[0].colorId;
        if (this.store.appPhase() === 'game') {
          this.store.buildSettlement(vertexId, colorId);
        } else if (!this.store.isSetupComplete()) {
          this.store.startSelectingRoad(vertexId);
        } else {
          this.store.placeSettlement(vertexId, colorId);
        }
      } else if (colors.length > 1) {
        this.openBuilderPicker(vertexId, colors);
      }
    }
  }

  private openBuilderPicker(
    vertexId: string,
    colors: { colorId: string; colorHex: string; name: string }[],
  ): void {
    const v = this.store.allVertices().find(vx => vx.id === vertexId);
    const pos = v?.position ?? { x: 0, y: 0 };

    const spacing = 38;
    const options = colors.map((c, idx) => {
      const offset = (idx - (colors.length - 1) / 2) * spacing;
      return {
        ...c,
        position: { x: pos.x + offset, y: pos.y - 28 },
      };
    });

    this.store.builderPickerVertexId.set(vertexId);
    this.store.builderPickerOptions.set(options);
  }

  protected selectBuilderFromPicker(colorId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.store.confirmBuilderPickerSelection(colorId);
  }

  protected closeBuilderPicker(): void {
    this.store.closeBuilderPicker();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (this.store.builderPickerOptions().length === 0) return;

    const target = event.target as Element | null;
    if (
      target?.closest?.('.builder-picker-layer') ||
      target?.parentElement?.closest?.('.builder-picker-layer')
    ) {
      return;
    }

    this.closeBuilderPicker();
  }

  @HostListener('contextmenu', ['$event'])
  onContextMenu(event: MouseEvent | PointerEvent): void {
    event.preventDefault();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (this.store.builderPickerOptions().length > 0) {
      event.preventDefault();
      event.stopPropagation();
      this.closeBuilderPicker();
    }
  }

  protected onVertexClick(v: Vertex): void {
    if (this.isHoldCompleted) {
      this.isHoldCompleted = false;
      return;
    }
    if (this.store.appPhase() === 'game' && this.store.activeBuildTool()) return;

    const wasSelectingRoad = this.store.isSelectingRoad();
    const wasSelected = this.store.selectedVertexId();

    if (wasSelectingRoad || wasSelected !== null) {
      // Clear current transient road selection state
      this.store.isSelectingRoad.set(false);
      this.store.pendingSettlementVertexId.set(null);
      this.store.currentRoadOptions.set([]);
      this.store.selectedVertexId.set(null);

      // If clicking a different vertex, select it
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

  protected onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const startX = (t1.clientX + t2.clientX) / 2;
      const startY = (t1.clientY + t2.clientY) / 2;
      const startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      this.twoFingerState = {
        active: true,
        disqualified: false,
        startX,
        startY,
        startDist,
        startTime: Date.now(),
        lastDeltaX: 0,
      };
    } else if (event.touches.length > 2 && this.twoFingerState) {
      this.twoFingerState.disqualified = true;
    }
  }

  protected onTouchMove(event: TouchEvent): void {
    if (!this.twoFingerState || !this.twoFingerState.active || this.twoFingerState.disqualified) {
      return;
    }
    if (event.touches.length !== 2) {
      this.twoFingerState.disqualified = true;
      return;
    }
    const t1 = event.touches[0];
    const t2 = event.touches[1];
    const currentX = (t1.clientX + t2.clientX) / 2;
    const currentY = (t1.clientY + t2.clientY) / 2;
    const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const distDelta = Math.abs(currentDist - this.twoFingerState.startDist);
    if (distDelta > 35) {
      this.twoFingerState.disqualified = true;
      return;
    }

    const deltaX = currentX - this.twoFingerState.startX;
    const deltaY = currentY - this.twoFingerState.startY;

    if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && Math.abs(deltaY) > 15) {
      this.twoFingerState.disqualified = true;
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    this.twoFingerState.lastDeltaX = deltaX;
  }

  protected onTouchEnd(): void {
    if (!this.twoFingerState?.active) {
      return;
    }
    const state = this.twoFingerState;
    this.twoFingerState = null;

    if (state.disqualified) {
      return;
    }

    const duration = Date.now() - state.startTime;
    const minDistance = 50;

    if (duration < 700 && Math.abs(state.lastDeltaX) >= minDistance) {
      if (state.lastDeltaX < 0) {
        if (this.canUndo()) {
          this.store.undo();
          this.showGestureToast('undo');
        }
      } else if (state.lastDeltaX > 0) {
        if (this.canRedo()) {
          this.store.redo();
          this.showGestureToast('redo');
        }
      }
    }
  }

  protected onTouchCancel(): void {
    this.twoFingerState = null;
  }

  private showGestureToast(action: 'undo' | 'redo'): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {
        // Ignore vibration errors if not supported or permitted
      }
    }
    const current = this.gestureToast();
    const newCount = current?.action === action ? current.count + 1 : 1;

    if (this.gestureToastTimeout) {
      clearTimeout(this.gestureToastTimeout);
    }
    this.gestureToast.set({ action, count: newCount, id: Date.now() });
    this.gestureToastTimeout = setTimeout(() => {
      this.gestureToast.set(null);
    }, 1500);
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

  protected onEdgePointerDown(
    event: PointerEvent,
    edge: {
      from: string;
      to: string;
      p1: { x: number; y: number };
      p2: { x: number; y: number };
      midpoint: { x: number; y: number };
      builders: { colorId: string; colorHex: string; name: string }[];
    },
  ): void {
    if (this.store.gameWinner()) return;

    if (event.cancelable) {
      event.preventDefault();
    }
    const target = event.currentTarget as HTMLElement | SVGElement | null;
    try {
      (target as Element)?.setPointerCapture?.(event.pointerId);
    } catch {
      // Ignore pointer capture errors on unsupported devices
    }

    const key = `${edge.from}_${edge.to}`;
    this.isHoldCompleted = false;
    this.holdingEdgeKey.set(key);
    this.edgeHoldProgress.set(0);
    this.holdStartTime = performance.now();
    this.holdPointerStartPos = { x: event.clientX, y: event.clientY };

    const DURATION = 1000;
    const animate = (now: number) => {
      if (this.holdingEdgeKey() !== key) return;
      const elapsed = now - this.holdStartTime;
      const progress = Math.min(1, elapsed / DURATION);

      this.ngZone.run(() => {
        this.edgeHoldProgress.set(progress);
      });

      if (progress >= 1) {
        this.isHoldCompleted = true;
        this.ngZone.run(() => {
          this.executeEdgeHoldAction(edge);
          this.cancelHold();
        });
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(40);
          } catch {
            // Ignore haptic vibration errors on unsupported devices
          }
        }
        return;
      }
      this.holdAnimFrame = requestAnimationFrame(animate);
    };
    this.holdAnimFrame = requestAnimationFrame(animate);
  }

  private executeEdgeHoldAction(edge: {
    from: string;
    to: string;
    midpoint: { x: number; y: number };
    builders: { colorId: string; colorHex: string; name: string }[];
  }): void {
    if (edge.builders.length === 1) {
      this.store.buildRoad(edge.from, edge.to, edge.builders[0]?.colorId);
    } else if (edge.builders.length > 1) {
      this.openEdgeBuilderPicker(edge);
    }
  }

  private openEdgeBuilderPicker(edge: {
    from: string;
    to: string;
    midpoint: { x: number; y: number };
    builders: { colorId: string; colorHex: string; name: string }[];
  }): void {
    const pos = edge.midpoint;
    const spacing = 38;
    const options = edge.builders.map((c, idx) => {
      const offset = (idx - (edge.builders.length - 1) / 2) * spacing;
      return {
        ...c,
        position: { x: pos.x + offset, y: pos.y - 24 },
      };
    });

    this.store.builderPickerEdge.set({ from: edge.from, to: edge.to });
    this.store.builderPickerOptions.set(options);
  }

  protected onRoadEdgeClick(fromId: string, toId: string): void {
    if (this.isHoldCompleted) {
      this.isHoldCompleted = false;
      return;
    }
    if (this.store.gameWinner()) return;

    // Single tap click ONLY builds if the Road Tool is explicitly active in the store
    if (this.store.activeBuildTool() === 'road') {
      this.store.buildRoad(fromId, toId);
    }
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
