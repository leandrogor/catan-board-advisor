import { Component, inject, computed } from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { EXT_BOARD_ROW_SIZES } from '../../data/ext-catan-board-layout.data';

@Component({
  selector: 'app-desert-config',
  standalone: true,
  template: `
    <div
      class="flex flex-wrap items-center justify-center gap-4 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800"
    >
      <!-- Desert 1 -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-amber-800 dark:text-amber-200" for="desert1">
          🏜️ {{ i18n.t().desert1Label }}
        </label>
        <select
          id="desert1"
          class="text-sm rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          [value]="desert1Value()"
          (change)="onDesert1Change($event)"
        >
          @for (opt of desert1Options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === desert1Value()">
              {{ opt.label }}
            </option>
          }
        </select>
      </div>

      <!-- Desert 2 -->
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-amber-800 dark:text-amber-200" for="desert2">
          🏜️ {{ i18n.t().desert2Label }}
        </label>
        <select
          id="desert2"
          class="text-sm rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 focus:ring-2 focus:ring-amber-500 focus:outline-none"
          [value]="desert2Value()"
          (change)="onDesert2Change($event)"
        >
          @for (opt of desert2Options(); track opt.value) {
            <option [value]="opt.value" [selected]="opt.value === desert2Value()">
              {{ opt.label }}
            </option>
          }
        </select>
      </div>
    </div>
  `,
})
export class DesertConfigComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  private readonly allPositions = computed(() => {
    const positions: { value: string; row: number; col: number; label: string }[] = [];
    const t = this.i18n.t();
    for (let row = 0; row < EXT_BOARD_ROW_SIZES.length; row++) {
      for (let col = 0; col < EXT_BOARD_ROW_SIZES[row]; col++) {
        positions.push({
          value: `${row}-${col}`,
          row,
          col,
          label: `${t.rowLabel} ${row}, ${t.colLabel} ${col}`,
        });
      }
    }
    return positions;
  });

  protected readonly desert1Value = computed(() => {
    const d = this.store.desertPositions();
    return `${d.L1.row}-${d.L1.col}`;
  });

  protected readonly desert2Value = computed(() => {
    const d = this.store.desertPositions();
    return `${d.L2.row}-${d.L2.col}`;
  });

  protected readonly desert1Options = computed(() =>
    this.allPositions().filter(p => p.value !== this.desert2Value()),
  );

  protected readonly desert2Options = computed(() =>
    this.allPositions().filter(p => p.value !== this.desert1Value()),
  );

  protected onDesert1Change(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const [row, col] = val.split('-').map(Number);
    this.store.updateDesertPosition('L1', { row, col });
  }

  protected onDesert2Change(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const [row, col] = val.split('-').map(Number);
    this.store.updateDesertPosition('L2', { row, col });
  }
}
