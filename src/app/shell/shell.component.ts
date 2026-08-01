import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '../core/services/translation.service';
import { ThemeService } from '../core/services/theme.service';
import { BoardStateStore } from '../features/board-advisor/services/board-state.store';
import { PLAYER_COLORS } from '../features/board-advisor/models/player-color.model';

import { KeyboardShortcutsService } from '../core/services/keyboard-shortcuts.service';
import { ShortcutsHelpModalComponent } from '../features/board-advisor/components/shortcuts-help-modal/shortcuts-help-modal.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, ShortcutsHelpModalComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly i18n = inject(TranslationService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(BoardStateStore);
  protected readonly shortcuts = inject(KeyboardShortcutsService);

  protected readonly targetDropdownOpen = signal<boolean>(false);

  protected get settingsOpen() {
    return this.shortcuts.settingsOpen;
  }

  protected getPlayerColorName(colorId: string): string {
    return this.store.getPlayerName(colorId);
  }

  protected getPlayerColorHex(colorId: string): string {
    return PLAYER_COLORS.find(c => c.id === colorId)?.hex ?? '#94a3b8';
  }

  protected selectProjectionTarget(targetId: string): void {
    this.store.setProjectionTargetPlayerId(targetId);
    this.targetDropdownOpen.set(false);
  }
}
