import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { hexPolygonPoints, interpolateHeatmapColor } from '../../../../shared/utils/hex-math.utils';
import { Vertex } from '../../models/vertex.model';
import { HexDefinition } from '../../models/hex.model';

@Component({
  selector: 'app-board',
  standalone: true,
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
      }
      .hex-polygon {
        transition: fill 0.2s ease;
      }
      .hex-polygon:hover {
        filter: brightness(1.1);
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
      .hex-tooltip-trigger {
        cursor: pointer;
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
    `,
  ],
})
export class BoardComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

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

  protected getPolygonPoints(hex: HexDefinition): string {
    return hexPolygonPoints(hex.center.x, hex.center.y, this.R());
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

  protected getFontSize(): number {
    return this.R() * 0.45;
  }

  protected onVertexClick(v: Vertex): void {
    if (v.isBlocked) return;
    this.store.selectVertex(this.store.selectedVertexId() === v.id ? null : v.id);
  }

  protected isSelected(v: Vertex): boolean {
    return this.store.selectedVertexId() === v.id;
  }

  protected isTopVertex(v: Vertex): boolean {
    return v.rank === 1;
  }

  protected getVertexAriaLabel(v: Vertex): string {
    const rankText = v.rank ? `Rank ${v.rank}` : 'Unranked';
    return `Vertex ${rankText}, score ${v.rawScore.toFixed(2)}`;
  }
}
