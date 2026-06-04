import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';

@Component({
  selector: 'app-board-controls',
  templateUrl: './board-controls.component.html',
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
