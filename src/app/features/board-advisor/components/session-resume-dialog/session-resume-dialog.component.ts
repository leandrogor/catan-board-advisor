import { Component, inject, output } from '@angular/core';
import { TranslationService } from '../../../../core/services/translation.service';

@Component({
  selector: 'app-session-resume-dialog',
  imports: [],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-100 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        class="bg-[#faf8f3] dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full p-6 space-y-4"
        style="animation: slideInUp 0.25s ease"
      >
        <div class="flex items-start gap-3">
          <span class="text-3xl mt-0.5">⏱</span>
          <div>
            <h2 class="font-bold text-slate-900 dark:text-slate-100 text-base leading-snug">
              {{ i18n.t().timerTitle }}
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {{ i18n.t().resumeSessionPrompt }}
            </p>
          </div>
        </div>

        <div class="flex gap-2 pt-1">
          <button
            type="button"
            id="session-resume-btn"
            class="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer border-0 transition-all bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95"
            (click)="resumeSession.emit()"
          >
            {{ i18n.t().resumeSession }}
          </button>
          <button
            type="button"
            id="session-discard-btn"
            class="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all active:scale-95"
            (click)="discardSession.emit()"
          >
            {{ i18n.t().discardSession }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SessionResumeDialogComponent {
  protected readonly i18n = inject(TranslationService);
  readonly resumeSession = output<void>();
  readonly discardSession = output<void>();
}
