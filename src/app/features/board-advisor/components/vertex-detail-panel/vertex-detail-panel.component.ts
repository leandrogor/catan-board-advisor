import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { HexDefinition } from '../../models/hex.model';

@Component({
  selector: 'app-vertex-detail-panel',
  templateUrl: './vertex-detail-panel.component.html',
})
export class VertexDetailPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly selectedVertex = computed(() => {
    const id = this.store.selectedVertexId();
    if (!id) return null;
    return this.store.rankedVertices().find(v => v.id === id) ?? null;
  });

  protected readonly roadOptions = computed(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return [];
    return this.store.computeRoadOptionsForVertex(vertex.id);
  });

  protected readonly adjacentHexes = computed<HexDefinition[]>(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return [];
    const hexes = this.store.hexes();
    return vertex.adjacentHexIds
      .map(hid => hexes.find(h => h.id === hid))
      .filter((h): h is HexDefinition => h !== undefined);
  });

  protected readonly adjacentNumbers = computed(
    () =>
      this.adjacentHexes()
        .filter(h => !h.isDesert && h.diceNumber !== null)
        .map(h => h.diceNumber)
        .join(' · ') || '—',
  );

  protected readonly adjacentLetters = computed(
    () =>
      this.adjacentHexes()
        .map(h => {
          const posKey = `${h.row}-${h.col}`;
          return this.store.spiralLetterAssignment().get(posKey) ?? h.letter;
        })
        .join(' · ') || '—',
  );

  protected readonly formattedScore = computed(() => {
    const vertex = this.selectedVertex();
    if (!vertex) return '—';
    const fmt = this.store.scoreFormat();
    if (fmt === 'percentage') {
      return `${(vertex.rawScore * 100).toFixed(1)}% ${this.i18n.t().avgResourcesPerRoll}`;
    }
    return `${vertex.rawScore.toFixed(3)} ${this.i18n.t().avgResourcesPerRoll}`;
  });

  protected formatValue(score: number): string {
    const fmt = this.store.scoreFormat();
    if (fmt === 'percentage') {
      return `${(score * 100).toFixed(1)}%`;
    }
    return score.toFixed(3);
  }
}
