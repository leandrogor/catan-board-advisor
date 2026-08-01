import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '../core/services/translation.service';
import { ThemeService } from '../core/services/theme.service';
import { BoardStateStore } from '../features/board-advisor/services/board-state.store';

import { KeyboardShortcutsService } from '../core/services/keyboard-shortcuts.service';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly i18n = inject(TranslationService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(BoardStateStore);
  protected readonly shortcuts = inject(KeyboardShortcutsService);
  protected get settingsOpen() {
    return this.shortcuts.settingsOpen;
  }
}
