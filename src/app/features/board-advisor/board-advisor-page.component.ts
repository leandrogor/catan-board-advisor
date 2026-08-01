import { Component, inject, ViewChild, ElementRef } from '@angular/core';
import { BoardComponent } from './components/board/board.component';
import { BoardControlsComponent } from './components/board-controls/board-controls.component';
import { VertexDetailPanelComponent } from './components/vertex-detail-panel/vertex-detail-panel.component';
import { HexInfoPanelComponent } from './components/hex-info-panel/hex-info-panel.component';
import { PlayerSetupComponent } from './components/player-setup/player-setup.component';
import { TurnIndicatorComponent } from './components/turn-indicator/turn-indicator.component';
import { SetupRankingComponent } from './components/setup-ranking/setup-ranking.component';
import { GameScoreboardComponent } from './components/game-scoreboard/game-scoreboard.component';
import { DevCardsPanelComponent } from './components/dev-cards-panel/dev-cards-panel.component';
import { GameStatsPanelComponent } from './components/game-stats-panel/game-stats-panel.component';
import { BoardStateStore } from './services/board-state.store';
import { TranslationService } from '../../core/services/translation.service';

import { KeyboardShortcutsService } from '../../core/services/keyboard-shortcuts.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-board-advisor-page',
  imports: [
    BoardComponent,
    BoardControlsComponent,
    VertexDetailPanelComponent,
    HexInfoPanelComponent,
    PlayerSetupComponent,
    TurnIndicatorComponent,
    SetupRankingComponent,
    GameScoreboardComponent,
    DevCardsPanelComponent,
    GameStatsPanelComponent,
  ],
  templateUrl: './board-advisor-page.component.html',
  styleUrl: './board-advisor-page.component.scss',
})
export class BoardAdvisorPageComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  protected readonly shortcuts = inject(KeyboardShortcutsService);

  @ViewChild('snapshotFileInput') private readonly snapshotFileInput!: ElementRef<HTMLInputElement>;

  constructor() {
    this.shortcuts.loadSnapshotRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.triggerSnapshotImport());
  }

  protected readonly settlementText = () =>
    this.i18n.t().settlementsPlaced(this.store.settledVertexIds().length);

  protected readonly selectedVertex = () => {
    const id = this.store.selectedVertexId();
    return id ? (this.store.rankedVertices().find(v => v.id === id) ?? null) : null;
  };

  protected confirmResetToSetup(): void {
    if (globalThis.confirm(this.i18n.t().resetConfirmMessage)) {
      this.store.resetToSetup();
    }
  }

  /** Opens the hidden file input so the user can pick a snapshot JSON. */
  protected triggerSnapshotImport(): void {
    this.snapshotFileInput.nativeElement.value = '';
    this.snapshotFileInput.nativeElement.click();
  }

  protected onSnapshotFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    file
      .text()
      .then(text => {
        try {
          const parsed = JSON.parse(text);
          const ok = this.store.importSnapshot(parsed);
          if (!ok) {
            globalThis.alert(this.i18n.t().snapshotInvalidError);
          }
        } catch {
          globalThis.alert(this.i18n.t().snapshotReadJsonError);
        }
      })
      .catch(() => {
        globalThis.alert(this.i18n.t().snapshotReadFileError);
      });
  }
}
