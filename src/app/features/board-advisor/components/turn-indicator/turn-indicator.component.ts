import { Component, inject, computed, signal, HostListener } from '@angular/core';
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
  protected readonly openSwapMenu = signal<boolean>(false);

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.openSwapMenu()) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const insideMenu = target.closest('.swap-dropdown-menu');
    const insideButton = target.closest('.swap-trigger-btn');
    if (!insideMenu && !insideButton) {
      this.openSwapMenu.set(false);
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (this.openSwapMenu()) {
      event.preventDefault();
      event.stopPropagation();
      this.openSwapMenu.set(false);
    }
  }

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

  protected readonly swappableOptions = computed(() => {
    if (!this.store.isRound1Placement()) return [];
    const colors = this.store.playerColors();
    const currentIdx = this.store.currentTurnIndex();
    return colors
      .map((color, idx) => ({
        color,
        idx,
        name: this.resolveColorName(color),
      }))
      .filter(item => item.idx > currentIdx);
  });

  protected toggleSwapMenu(): void {
    this.openSwapMenu.update(open => !open);
  }

  protected swapActivePlayerWith(targetSlotIndex: number): void {
    this.store.swapPlayerOrder(this.store.currentTurnIndex(), targetSlotIndex);
    this.openSwapMenu.set(false);
  }

  protected resolveColorName(player: PlayerColor): string {
    return this.store.getPlayerName(player.id);
  }
}
