import { Component, inject, ViewChild, ElementRef, computed, signal } from '@angular/core';
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
import { GameTimerPanelComponent } from './components/game-timer-panel/game-timer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
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
    GameTimerPanelComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './board-advisor-page.component.html',
  styleUrl: './board-advisor-page.component.scss',
})
export class BoardAdvisorPageComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  protected readonly shortcuts = inject(KeyboardShortcutsService);
  protected readonly timer = this.store.timerService;

  /** Whether to show the resume session dialog (checked once on startup). */
  protected readonly showResumeDialog = signal<boolean>(this.store.hasResumableSession());

  /** Whether to show the reset board confirmation dialog. */
  protected readonly showResetConfirmDialog = signal<boolean>(false);

  @ViewChild('snapshotFileInput') private readonly snapshotFileInput!: ElementRef<HTMLInputElement>;

  constructor() {
    this.shortcuts.loadSnapshotRequested$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.triggerSnapshotImport());
  }

  /** Handles the resume session choice. */
  protected resumeSession(): void {
    this.store.restoreAutosavedSession();
    this.showResumeDialog.set(false);
  }

  /** Discards saved session and starts fresh. */
  protected discardSession(): void {
    this.store.clearAutosave();
    this.showResumeDialog.set(false);
  }

  /** Formatted elapsed timer for the floating button badge. */
  protected readonly timerBadge = computed<string>(() => {
    if (!this.timer.isStarted()) return this.i18n.t().timerStartNow;
    if (this.timer.isFinished()) return '🏆 ' + this.timer.compactElapsedFormatted();
    return this.timer.compactElapsedFormatted();
  });

  /** Starts the timer setup phase if not yet started (manual trigger). */
  protected startTimerSetup(): void {
    if (!this.timer.isStarted()) {
      this.timer.startSetup(this.i18n.t().timerSetupStart);
    } else {
      this.timer.togglePanel();
    }
  }

  protected readonly settlementText = () =>
    this.i18n.t().settlementsPlaced(this.store.settledVertexIds().length);

  protected readonly selectedVertex = () => {
    const id = this.store.selectedVertexId();
    return id ? (this.store.rankedVertices().find(v => v.id === id) ?? null) : null;
  };

  protected confirmResetToSetup(): void {
    this.showResetConfirmDialog.set(true);
  }

  protected handleResetConfirmed(): void {
    this.showResetConfirmDialog.set(false);
    this.store.resetToSetup();
  }

  protected handleResetCanceled(): void {
    this.showResetConfirmDialog.set(false);
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
