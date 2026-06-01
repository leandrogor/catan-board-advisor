import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { HexDefinition } from '../../models/hex.model';

@Component({
  selector: 'app-vertex-detail-panel',
  template: `
    @if (selectedVertex(); as vertex) {
      <div
        class="fixed bottom-0 left-0 right-0 z-20 transform transition-transform duration-300 ease-out lg:relative lg:bottom-auto lg:inset-auto lg:z-auto"
        [class.translate-y-0]="vertex"
      >
        <div
          class="mx-auto max-w-lg lg:max-w-none bg-white dark:bg-slate-800 rounded-t-2xl lg:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5"
        >
          <!-- Header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              @if (vertex.rank) {
                <span
                  class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold"
                  [class]="
                    vertex.rank === 1
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  "
                >
                  #{{ vertex.rank }}
                </span>
              }
              <span class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {{
                  vertex.rank === 1
                    ? i18n.t().bestPosition
                    : vertex.isOccupied
                      ? i18n.t().occupied
                      : vertex.isBlocked
                        ? i18n.t().blocked
                        : '#' + vertex.rank
                }}
              </span>
            </div>
            <button
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none p-1"
              (click)="store.selectVertex(null)"
              [attr.aria-label]="i18n.t().close"
            >
              ×
            </button>
          </div>

          <!-- Score -->
          <div class="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
            <div>
              <span class="font-medium">{{ i18n.t().score }}:</span>
              {{ formattedScore() }}
            </div>
            <div>
              <span class="font-medium">{{ i18n.t().adjacentNumbers }}:</span>
              {{ adjacentNumbers() }}
            </div>
            <div>
              <span class="font-medium">{{ i18n.t().adjacentLetters }}:</span>
              {{ adjacentLetters() }}
            </div>
          </div>

          @if (vertex.isBlocked) {
            <p class="mt-3 text-sm text-amber-600 dark:text-amber-400 italic">
              {{ i18n.t().blockedDescription }}
            </p>
          }

          <!-- Action button -->
          <div class="mt-4">
            @if (vertex.isOccupied) {
              <button
                class="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                       bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300
                       hover:bg-red-200 dark:hover:bg-red-900/50"
                (click)="store.removeSettlement(vertex.id)"
              >
                {{ i18n.t().removeSettlement }}
              </button>
            } @else if (!vertex.isBlocked) {
              <button
                class="w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-colors
                       bg-indigo-600 dark:bg-indigo-500 text-white
                       hover:bg-indigo-700 dark:hover:bg-indigo-600"
                (click)="store.placeSettlement(vertex.id)"
              >
                {{ i18n.t().placeSettlement }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class VertexDetailPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly selectedVertex = computed(() => {
    const id = this.store.selectedVertexId();
    if (!id) return null;
    return this.store.rankedVertices().find(v => v.id === id) ?? null;
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
          // Use spiral assignment letter for Phase 2 display
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
}
