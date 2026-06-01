import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';

@Component({
  selector: 'app-board-controls',
  template: `
    <div
      class="flex items-center justify-center gap-3 px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700"
    >
      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
               bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
               hover:bg-slate-200 dark:hover:bg-slate-700
               disabled:opacity-40 disabled:cursor-not-allowed"
        [disabled]="!canUndo()"
        (click)="store.undo()"
        [attr.aria-label]="i18n.t().undo"
      >
        <span>←</span> {{ i18n.t().undo }}
      </button>

      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
               bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
               hover:bg-slate-200 dark:hover:bg-slate-700
               disabled:opacity-40 disabled:cursor-not-allowed"
        [disabled]="!canRedo()"
        (click)="store.redo()"
        [attr.aria-label]="i18n.t().redo"
      >
        {{ i18n.t().redo }} <span>→</span>
      </button>

      <button
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
               bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300
               hover:bg-indigo-200 dark:hover:bg-indigo-800/50"
        (click)="store.rotateBoard()"
        [attr.aria-label]="i18n.t().rotateBoard"
      >
        ⟳ {{ i18n.t().rotateBoard }}
      </button>

      @if (store.appPhase() !== 'setup') {
        <span class="text-sm text-slate-500 dark:text-slate-400 ml-2">
          {{ settlementText() }}
        </span>
      }
    </div>
  `,
})
export class BoardControlsComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

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

  protected readonly settlementText = computed(() =>
    this.i18n.t().settlementsPlaced(this.store.settledVertexIds().length),
  );
}
