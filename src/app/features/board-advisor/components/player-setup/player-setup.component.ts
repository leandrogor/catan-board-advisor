import { Component, inject, signal } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PLAYER_COLORS, PlayerColor } from '../../models/player-color.model';

@Component({
  selector: 'app-player-setup',
  template: `
    <div
      class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 p-4 space-y-3"
    >
      <!-- Player count — two groups: Base (3|4) and Extension (5|6) -->
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {{ i18n.t().playerCount }}
        </span>
        <div class="flex gap-3" role="group" [attr.aria-label]="i18n.t().playerCount">
          <!-- Base group: 3 & 4 -->
          <div class="flex flex-col items-center gap-0.5">
            <div class="flex gap-1">
              @for (n of [3, 4]; track n) {
                <button
                  class="w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150"
                  [class]="
                    store.playerCount() === n
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : store.boardVariant() === 'base'
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  "
                  [attr.id]="'player-count-' + n"
                  (click)="store.setPlayerCount(asCount(n))"
                  [attr.aria-pressed]="store.playerCount() === n"
                >
                  {{ n }}
                </button>
              }
            </div>
            <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">
              {{ i18n.t().boardGroupBase }}
            </span>
          </div>

          <!-- Divider -->
          <div class="self-stretch flex items-center">
            <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 self-center"></div>
          </div>

          <!-- Extension group: 5 & 6 -->
          <div class="flex flex-col items-center gap-0.5">
            <div class="flex gap-1">
              @for (n of [5, 6]; track n) {
                <button
                  class="w-10 h-10 rounded-xl text-sm font-bold transition-all duration-150"
                  [class]="
                    store.playerCount() === n
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : store.boardVariant() === 'ext'
                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800/50'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  "
                  [attr.id]="'player-count-' + n"
                  (click)="store.setPlayerCount(asCount(n))"
                  [attr.aria-pressed]="store.playerCount() === n"
                >
                  {{ n }}
                </button>
              }
            </div>
            <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide">
              {{ i18n.t().boardGroupExt }}
            </span>
          </div>
        </div>
      </div>

      <!-- Color order row -->
      <div class="space-y-1.5">
        <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {{ i18n.t().colorOrder }}
        </span>
        <div class="flex items-center gap-2 flex-wrap">
          @for (color of store.playerColors(); track color.id; let idx = $index) {
            <div class="relative flex flex-col items-center">
              <button
                class="relative flex flex-col items-center gap-0.5 group"
                [attr.id]="'player-chip-' + idx"
                (click)="togglePicker(idx)"
                [attr.aria-label]="colorName(color) + ' player ' + (idx + 1)"
              >
                <!-- Slot number -->
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 leading-none">
                  {{ idx + 1 }}
                </span>
                <!-- Color chip -->
                <div
                  class="w-9 h-9 rounded-full border-2 border-white dark:border-slate-600 shadow-md transition-all duration-150 group-hover:scale-110 group-hover:shadow-lg"
                  [style.background-color]="color.hex"
                  [class]="
                    openPickerSlot() === idx ? 'ring-2 ring-offset-1 ring-indigo-500 scale-110' : ''
                  "
                ></div>
              </button>

              <!-- Me/Yo toggle button -->
              <button
                (click)="store.setMyPlayerColorId(color.id)"
                class="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all duration-150 cursor-pointer select-none"
                [class]="
                  store.myPlayerColorId() === color.id
                    ? 'bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                "
              >
                {{
                  store.myPlayerColorId() === color.id
                    ? '👤 ' + i18n.t().isMeLabel
                    : i18n.t().isMeLabel
                }}
              </button>
              <!-- Inline color picker -->
              @if (openPickerSlot() === idx) {
                @let isFirst = idx === 0;
                @let isLast = idx === store.playerColors().length - 1;
                <div
                  class="absolute bottom-full mb-2 z-20
                         bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700
                         p-2 flex gap-1.5 flex-wrap w-38"
                  [class]="
                    isFirst ? 'left-0' : isLast ? 'right-0 left-auto' : 'left-1/2 -translate-x-1/2'
                  "
                  role="menu"
                  [attr.aria-label]="'Pick color for player ' + (idx + 1)"
                >
                  @for (pc of allColors; track pc.id) {
                    @let isCurrentSlot = pc.id === color.id;
                    @let isUsedElsewhere = isColorUsed(pc, idx);
                    <button
                      class="w-9 h-9 rounded-full border-2 transition-all duration-150 relative"
                      [style.background-color]="pc.hex"
                      [class]="
                        isCurrentSlot
                          ? 'border-indigo-500 ring-2 ring-indigo-400 ring-offset-1 scale-110'
                          : isUsedElsewhere
                            ? 'border-white/40 dark:border-slate-500 opacity-60 hover:opacity-100 hover:scale-105'
                            : 'border-white dark:border-slate-600 hover:scale-110 hover:shadow-md cursor-pointer'
                      "
                      (click)="selectColor(idx, pc)"
                      [attr.aria-label]="colorName(pc)"
                      role="menuitem"
                    ></button>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class PlayerSetupComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  protected readonly allColors: PlayerColor[] = PLAYER_COLORS;
  protected readonly openPickerSlot = signal<number | null>(null);

  protected colorName(color: PlayerColor): string {
    const t = this.i18n.t();
    const map: Record<PlayerColor['id'], string> = {
      red: t.colorRed,
      blue: t.colorBlue,
      mustard: t.colorMustard,
      cream: t.colorCream,
      green: t.colorGreen,
      chocolate: t.colorChocolate,
    };
    return map[color.id];
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
