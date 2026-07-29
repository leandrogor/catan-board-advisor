import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

@Component({
  selector: 'app-turn-indicator',
  templateUrl: './turn-indicator.component.html',
  styleUrl: './turn-indicator.component.scss',
})
export class TurnIndicatorComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly indicatorText = computed(() => {
    const player = this.store.currentPlayerColor();
    if (!player) return '';
    const turn = this.store.currentTurnIndex() + 1;
    const total = this.store.totalTurns();
    let colorName = this.resolveColorName(player);
    if (player.id === this.store.myPlayerColorId()) {
      colorName += ` (${this.i18n.t().isMeLabel})`;
    }
    return this.i18n.t().turnIndicator(turn, total, colorName);
  });

  private resolveColorName(player: PlayerColor): string {
    return this.store.getPlayerName(player.id);
  }
}
