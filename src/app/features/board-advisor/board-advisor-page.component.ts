import { Component, inject } from '@angular/core';
import { BoardComponent } from './components/board/board.component';
import { BoardControlsComponent } from './components/board-controls/board-controls.component';
import { VertexDetailPanelComponent } from './components/vertex-detail-panel/vertex-detail-panel.component';
import { HexInfoPanelComponent } from './components/hex-info-panel/hex-info-panel.component';
import { PlayerSetupComponent } from './components/player-setup/player-setup.component';
import { TurnIndicatorComponent } from './components/turn-indicator/turn-indicator.component';
import { SetupRankingComponent } from './components/setup-ranking/setup-ranking.component';
import { BoardStateStore } from './services/board-state.store';
import { TranslationService } from '../../core/services/translation.service';

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
  ],
  templateUrl: './board-advisor-page.component.html',
  styleUrl: './board-advisor-page.component.scss',
})
export class BoardAdvisorPageComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

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
}
