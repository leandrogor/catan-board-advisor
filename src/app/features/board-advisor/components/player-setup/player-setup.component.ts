import { Component, inject, signal } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PLAYER_COLORS, PlayerColor } from '../../models/player-color.model';

@Component({
  selector: 'app-player-setup',
  templateUrl: './player-setup.component.html',
  styleUrl: './player-setup.component.scss',
})
export class PlayerSetupComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  protected readonly allColors: PlayerColor[] = PLAYER_COLORS;
  protected readonly openPickerSlot = signal<number | null>(null);

  protected colorName(color: PlayerColor): string {
    return this.store.getPlayerName(color.id);
  }

  protected getPlayerCustomName(colorId: string): string {
    return this.store.playerNames()[colorId] || '';
  }

  protected onNameInput(colorId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.store.setPlayerName(colorId, input.value);
  }

  protected isColorUsed(color: PlayerColor, slotIndex: number): boolean {
    const colors = this.store.playerColors();
    return colors.some((c, i) => c.id === color.id && i !== slotIndex);
  }

  protected togglePicker(slot: number): void {
    this.openPickerSlot.update(current => (current === slot ? null : slot));
  }

  protected selectColor(slot: number, color: PlayerColor): void {
    this.store.setPlayerColorAt(slot, color);
    this.openPickerSlot.set(null);
  }

  protected asCount(n: number): 3 | 4 | 5 | 6 {
    return n as 3 | 4 | 5 | 6;
  }
}
