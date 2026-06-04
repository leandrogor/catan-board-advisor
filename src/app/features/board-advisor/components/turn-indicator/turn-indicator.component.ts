import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

@Component({
  selector: 'app-turn-indicator',
  template: `
    @if (store.appPhase() === 'results' && !store.isSetupComplete()) {
      @let player = store.currentPlayerColor();
      @if (player) {
        <div
          class="flex items-center justify-center gap-2.5 px-4 py-2.5
                 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm
                 border-t border-b border-slate-200 dark:border-slate-700
                 shadow-sm"
          role="status"
          [attr.aria-label]="indicatorText()"
        >
          <!-- Color swatch -->
          <span
            class="inline-block w-5 h-5 rounded-full shadow-sm ring-2 ring-white dark:ring-slate-700 flex-shrink-0"
            [style.background-color]="player.hex"
          ></span>
          <!-- Text -->
          <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-wide">
            {{ indicatorText() }}
          </span>
        </div>
      }
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
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
    const t = this.i18n.t();
    const map: Record<PlayerColor['id'], string> = {
      red: t.colorRed,
      blue: t.colorBlue,
      mustard: t.colorMustard,
      cream: t.colorCream,
      green: t.colorGreen,
      chocolate: t.colorChocolate,
    };
    return map[player.id];
  }
}
