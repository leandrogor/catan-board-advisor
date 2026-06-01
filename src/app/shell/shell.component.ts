import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from '../core/services/translation.service';
import { ThemeService } from '../core/services/theme.service';
import { BoardStateStore } from '../features/board-advisor/services/board-state.store';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet],
  template: `
    <!-- Header -->
    <header
      class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700"
    >
      <button
        class="text-sm font-medium px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        (click)="i18n.toggle()"
        [attr.aria-label]="i18n.t().language"
      >
        🌐 {{ i18n.lang() === 'en' ? 'EN' : 'ES' }}
      </button>

      <div class="text-center">
        <h1 class="text-lg font-bold text-slate-900 dark:text-white">{{ i18n.t().appTitle }}</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400">{{ i18n.t().appSubtitle }}</p>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="text-lg p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          (click)="theme.toggle()"
          [attr.aria-label]="theme.isDark() ? i18n.t().lightMode : i18n.t().darkMode"
        >
          {{ theme.isDark() ? '☀️' : '🌙' }}
        </button>
        <button
          class="text-lg p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          (click)="settingsOpen.set(!settingsOpen())"
          [attr.aria-label]="i18n.t().settings"
        >
          ⚙️
        </button>
      </div>
    </header>

    <!-- Settings drawer -->
    @if (settingsOpen()) {
      <div class="fixed inset-0 z-40" (click)="settingsOpen.set(false)">
        <div class="absolute inset-0 bg-black/30"></div>
        <div
          class="absolute right-0 top-0 h-full w-72 bg-white dark:bg-slate-800 shadow-xl p-5 transform transition-transform"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              {{ i18n.t().settings }}
            </h2>
            <button
              class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl"
              (click)="settingsOpen.set(false)"
            >
              ×
            </button>
          </div>

          <div class="space-y-5">
            <!-- Score format -->
            <div>
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">{{
                i18n.t().scoreFormat
              }}</label>
              <div class="mt-2 flex gap-2">
                <button
                  class="flex-1 text-sm py-1.5 rounded-md transition-colors"
                  [class]="
                    store.scoreFormat() === 'decimal'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  "
                  (click)="store.scoreFormat.set('decimal')"
                >
                  {{ i18n.t().decimal }}
                </button>
                <button
                  class="flex-1 text-sm py-1.5 rounded-md transition-colors"
                  [class]="
                    store.scoreFormat() === 'percentage'
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  "
                  (click)="store.scoreFormat.set('percentage')"
                >
                  {{ i18n.t().percentage }}
                </button>
              </div>
            </div>

            <!-- Show zero scores -->
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-slate-700 dark:text-slate-300">{{
                i18n.t().showZeroScores
              }}</label>
              <button
                class="relative w-11 h-6 rounded-full transition-colors"
                [class]="
                  store.showZeroScores() ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                "
                (click)="store.toggleShowZeroScores()"
                role="switch"
                [attr.aria-checked]="store.showZeroScores()"
              >
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  [class.translate-x-5]="store.showZeroScores()"
                ></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- Main content -->
    <main class="min-h-[calc(100dvh-120px)]">
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {
  protected readonly i18n = inject(TranslationService);
  protected readonly theme = inject(ThemeService);
  protected readonly store = inject(BoardStateStore);
  protected readonly settingsOpen = signal(false);
}
