import { Component, inject, computed, signal, ElementRef, HostListener } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { hexPolygonPoints, interpolateHeatmapColor } from '../../../../shared/utils/hex-math.utils';
import { Vertex } from '../../models/vertex.model';
import { HexDefinition } from '../../models/hex.model';

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
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .board-wrapper {
        transition: transform 0.35s ease;
        transform-origin: center center;
        overflow: visible;
        /* On desktop constrain height so it fits without scrolling */
      }
      @media (min-width: 1024px) {
        :host {
          max-height: 100%;
        }
        .board-wrapper {
          width: auto;
          max-width: 100%;
          max-height: calc(100dvh - 69px);
        }
      }
      .hex-polygon {
        transition: fill 0.2s ease;
      }
      .hex-polygon:hover {
        filter: brightness(1.08);
      }
      .hex-polygon.desert-draggable {
        cursor: grab;
      }
      .hex-polygon.desert-draggable:active {
        cursor: grabbing;
      }
      .hex-polygon.drop-target {
        filter: brightness(1.25);
        stroke: var(--color-top-vertex, #f59e0b) !important;
        stroke-width: 3px !important;
      }
      .hex-clickable {
        cursor: pointer;
      }
      .vertex-circle {
        cursor: pointer;
        transition:
          r 0.2s ease,
          fill 0.2s ease,
          opacity 0.2s ease;
      }
      .vertex-circle:hover {
        filter: brightness(1.2);
      }
      .vertex-blocked {
        cursor: default;
        pointer-events: none;
      }
      .hex-number {
        pointer-events: none;
        user-select: none;
      }
      @keyframes pulse-ring {
        0% {
          stroke-opacity: 1;
        }
        50% {
          stroke-opacity: 0.5;
        }
        100% {
          stroke-opacity: 1;
        }
      }
      .top-vertex-ring {
        animation: pulse-ring 2s ease-in-out infinite;
      }
      .ghost-desert {
        pointer-events: none;
        opacity: 0.75;
      }
    `,
  ],
})
export class BoardComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  private readonly el = inject(ElementRef);

  protected readonly viewBox = computed(() => {
    const vb = this.store.viewBox();
    return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`;
  });

  protected readonly rotationStyle = computed(
    () => `transform: rotate(${this.store.boardRotationDeg()}deg)`,
  );

  protected readonly R = computed(() => this.store.hexSize());

  protected readonly displayVertices = computed(() => {
    const vertices = this.store.rankedVertices();
    const showZeros = this.store.showZeroScores();
    if (showZeros) return vertices;
    return vertices.filter(v => v.normalizedScore > 0 || v.isOccupied);
  });

  // ── Drag state (Phase 1 desert drag) ─────────────────────────────────────
  protected readonly draggingDesert = signal<'L1' | 'L2' | null>(null);
  protected readonly ghostSvgX = signal<number>(0);
  protected readonly ghostSvgY = signal<number>(0);
  protected readonly dropTargetHexId = signal<string | null>(null);

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
    if (v.isOccupied) return 'var(--color-occupied)';
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
    if (v.isBlocked) return;
    this.store.selectVertex(this.store.selectedVertexId() === v.id ? null : v.id);
  }

  protected onHexClick(hex: HexDefinition): void {
    if (hex.isDesert) return; // Deserts are drag handles, not click targets
    if (this.store.appPhase() === 'setup') {
      this.store.toggleHexDisplay();
    } else {
      this.store.selectHex(this.store.selectedHexId() === hex.id ? null : hex.id);
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

    const svg = this.getSvgElement();
    if (svg) {
      (event.target as Element).setPointerCapture(event.pointerId);
      const svgPt = this.clientToSvg(svg, event.clientX, event.clientY);
      this.ghostSvgX.set(svgPt.x);
      this.ghostSvgY.set(svgPt.y);
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event: PointerEvent): void {
    if (this.draggingDesert() === null || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();

    const svg = this.getSvgElement();
    if (!svg) return;

    const svgPt = this.clientToSvg(svg, event.clientX, event.clientY);
    this.ghostSvgX.set(svgPt.x);
    this.ghostSvgY.set(svgPt.y);

    // Find the hex closest to the pointer (hit-test by center distance)
    const targetHex = this.findHexAtSvgPoint(svgPt.x, svgPt.y);
    this.dropTargetHexId.set(targetHex?.id ?? null);
  }

  @HostListener('pointerup', ['$event'])
  onPointerUp(event: PointerEvent): void {
    if (this.draggingDesert() === null || event.pointerId !== this.dragPointerId) return;
    event.preventDefault();

    const desert = this.draggingDesert();
    const targetId = this.dropTargetHexId();

    if (desert && targetId) {
      // Parse row/col from hex id: "hex-{row}-{col}"
      const parts = targetId.split('-');
      const row = Number.parseInt(parts[1], 10);
      const col = Number.parseInt(parts[2], 10);
      this.store.updateDesertPosition(desert, { row, col });
    }

    this.draggingDesert.set(null);
    this.dropTargetHexId.set(null);
    this.dragPointerId = null;
  }

  @HostListener('pointercancel', ['$event'])
  onPointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId) return;
    this.draggingDesert.set(null);
    this.dropTargetHexId.set(null);
    this.dragPointerId = null;
  }

  /** Ghost transform for the dragged desert preview. */
  protected ghostTransform = computed(() => {
    return `translate(${this.ghostSvgX()}, ${this.ghostSvgY()})`;
  });

  // ── Private helpers ───────────────────────────────────────────────────────

  private getSvgElement(): SVGSVGElement | null {
    return this.el.nativeElement.querySelector('svg') as SVGSVGElement | null;
  }

  private clientToSvg(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    return {
      x: inv.a * clientX + inv.c * clientY + inv.e,
      y: inv.b * clientX + inv.d * clientY + inv.f,
    };
  }

  /**
   * Find the hex whose center is closest to (svgX, svgY), within R*1.15 distance.
   * Excludes the hex currently being dragged.
   */
  private findHexAtSvgPoint(svgX: number, svgY: number): HexDefinition | null {
    const R = this.R();
    const threshold = R * 1.15;
    const dragging = this.draggingDesert();
    const desertPos = this.store.desertPositions();

    // The other desert's position (cannot be a drop target)
    const otherDesert = dragging === 'L1' ? 'L2' : 'L1';
    const otherPos = desertPos[otherDesert];
    const otherKey = `${otherPos.row}-${otherPos.col}`;

    let best: HexDefinition | null = null;
    let bestDist = Infinity;

    for (const hex of this.store.hexes()) {
      // Cannot drop on the other desert
      if (`${hex.row}-${hex.col}` === otherKey) continue;
      // Cannot drop on the same hex we started from
      const myPos = desertPos[dragging ?? 'L1'];
      if (hex.row === myPos.row && hex.col === myPos.col) continue;

      const dx = hex.center.x - svgX;
      const dy = hex.center.y - svgY;
      const dist = Math.hypot(dx, dy);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        best = hex;
      }
    }

    return best;
  }
}
