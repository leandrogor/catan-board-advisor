import { Component, HostListener, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  imports: [],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style="animation: backdropFadeIn 0.2s ease"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-desc"
      (click)="onBackdropClick()"
    >
      <!-- Modal Card -->
      <div
        class="bg-[#faf8f3] dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full p-6 space-y-4 text-left"
        style="animation: slideInUp 0.25s ease"
        (click)="$event.stopPropagation()"
      >
        <!-- Header / Icon + Text -->
        <div class="flex items-start gap-3.5">
          @if (icon()) {
            <span class="text-3xl mt-0.5 select-none shrink-0" aria-hidden="true">{{
              icon()
            }}</span>
          }
          <div class="flex-1 min-w-0">
            <h2
              id="dialog-title"
              class="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug"
            >
              {{ title() }}
            </h2>
            <p
              id="dialog-desc"
              class="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed"
            >
              {{ message() }}
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            [id]="confirmBtnId() ?? 'dialog-confirm-btn'"
            class="flex-1 py-2.5 px-3 rounded-xl text-sm font-bold cursor-pointer border-0 transition-all text-white shadow-md hover:shadow-lg active:scale-95 text-center focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            [class]="
              variant() === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 focus:ring-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 focus:ring-indigo-500'
            "
            (click)="confirmed.emit()"
          >
            {{ confirmText() }}
          </button>

          @if (cancelText()) {
            <button
              type="button"
              [id]="cancelBtnId() ?? 'dialog-cancel-btn'"
              class="flex-1 py-2.5 px-3 rounded-xl text-sm font-medium cursor-pointer border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95 text-center focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
              (click)="cancelled.emit()"
            >
              {{ cancelText() }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly icon = input<string>('');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmText = input<string>('OK');
  readonly cancelText = input<string | null>(null);
  readonly variant = input<'primary' | 'danger'>('primary');
  readonly closeOnBackdrop = input<boolean>(true);
  readonly confirmBtnId = input<string | null>(null);
  readonly cancelBtnId = input<string | null>(null);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    this.cancelled.emit();
  }

  protected onBackdropClick(): void {
    if (this.closeOnBackdrop()) {
      this.cancelled.emit();
    }
  }
}
