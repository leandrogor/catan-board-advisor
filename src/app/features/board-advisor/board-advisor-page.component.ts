import { Component, inject } from '@angular/core';
import { BoardComponent } from './components/board/board.component';
import { BoardControlsComponent } from './components/board-controls/board-controls.component';
import { VertexDetailPanelComponent } from './components/vertex-detail-panel/vertex-detail-panel.component';
import { HexInfoPanelComponent } from './components/hex-info-panel/hex-info-panel.component';
import { BoardStateStore } from './services/board-state.store';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-board-advisor-page',
  imports: [
    BoardComponent,
    BoardControlsComponent,
    VertexDetailPanelComponent,
    HexInfoPanelComponent,
  ],
  template: `
    <!--
      Two-column layout on desktop (lg:≥1024px):
        Left  (~65%): SVG board
        Right (~35%): phase-aware control panel

      Single-column on mobile: board → right panel stacked vertically.
    -->
    <div class="flex flex-col lg:flex-row lg:h-full lg:overflow-hidden flex-1">
      <!-- ── Left: Board ─────────────────────────────────────── -->
      <div
        class="flex-1 lg:flex-65 flex items-center justify-center p-2 lg:p-4 lg:h-full lg:overflow-hidden"
      >
        <app-board />
      </div>

      <!-- ── Right: Phase panel ──────────────────────────────── -->
      <aside
        class="lg:flex-35 lg:overflow-y-auto lg:border-l border-slate-200 dark:border-slate-700
               flex flex-col"
      >
        @if (store.appPhase() === 'setup') {
          <!-- ── Phase 1: Setup panel ──────────────────────────── -->
          <div class="flex flex-col gap-4 p-5">
            <!-- Setup card -->
            <div
              class="rounded-2xl border border-amber-200 dark:border-amber-800
                     bg-linear-to-br from-amber-50 to-orange-50
                     dark:from-amber-950/40 dark:to-orange-950/30 p-5 space-y-3"
            >
              <div class="flex items-center gap-2">
                <span class="text-2xl">🏜️</span>
                <h2 class="text-lg font-bold text-amber-900 dark:text-amber-100">
                  {{ i18n.t().setupTitle }}
                </h2>
              </div>
              <p class="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                {{ i18n.t().setupHint }}
              </p>

              <!-- Desert position indicators -->
              <div class="grid grid-cols-2 gap-2 pt-1">
                <div
                  class="flex flex-col items-center gap-1 p-3 rounded-xl
                         bg-white/60 dark:bg-slate-800/60 border border-amber-200 dark:border-amber-700"
                >
                  <span class="text-xl">🏜️</span>
                  <span class="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {{ i18n.t().desert1Label }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {{ i18n.t().rowLabel }} {{ store.desertPositions().L1.row }},
                    {{ i18n.t().colLabel }} {{ store.desertPositions().L1.col }}
                  </span>
                </div>
                <div
                  class="flex flex-col items-center gap-1 p-3 rounded-xl
                         bg-white/60 dark:bg-slate-800/60 border border-amber-200 dark:border-amber-700"
                >
                  <span class="text-xl">🏜️</span>
                  <span class="text-xs font-semibold text-amber-800 dark:text-amber-200">
                    {{ i18n.t().desert2Label }}
                  </span>
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    {{ i18n.t().rowLabel }} {{ store.desertPositions().L2.row }},
                    {{ i18n.t().colLabel }} {{ store.desertPositions().L2.col }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Tap hint -->
            <p class="text-xs text-center text-slate-500 dark:text-slate-400">
              {{ i18n.t().setupToggleHint }}
            </p>

            <!-- Controls (undo/redo/rotate) — inline on desktop during setup -->
            <div
              class="hidden lg:flex items-center justify-center gap-2 flex-wrap
                     px-3 py-2.5 rounded-xl
                     bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700"
            >
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed"
                [disabled]="store.desertUndoStack().length === 0"
                (click)="store.undo()"
              >
                ← {{ i18n.t().undo }}
              </button>
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed"
                [disabled]="store.desertRedoStack().length === 0"
                (click)="store.redo()"
              >
                {{ i18n.t().redo }} →
              </button>
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300
                       hover:bg-indigo-200 dark:hover:bg-indigo-800/50"
                (click)="store.rotateBoard()"
              >
                ⟳ {{ i18n.t().rotateBoard }}
              </button>
            </div>

            <!-- Start simulation button -->
            <button
              class="w-full py-4 px-6 rounded-2xl text-base font-bold tracking-wide transition-all duration-200
                     bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500
                     text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40
                     hover:scale-[1.02] active:scale-[0.98]
                     disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              [disabled]="store.isSimulating()"
              (click)="store.startSimulation()"
            >
              @if (store.isSimulating()) {
                <span class="flex items-center justify-center gap-2">
                  <span class="animate-spin">⚙️</span>
                  {{ i18n.t().simulating }}
                </span>
              } @else {
                {{ i18n.t().startSimulation }}
              }
            </button>
          </div>
        } @else {
          <!-- ── Phase 2: Results panel ─────────────────────────── -->
          <div class="flex flex-col gap-3 p-5">
            <!-- Reset button -->
            <button
              class="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-medium
                     transition-all duration-200
                     bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                     hover:bg-slate-200 dark:hover:bg-slate-700
                     border border-slate-200 dark:border-slate-600"
              (click)="store.resetToSetup()"
            >
              {{ i18n.t().resetToSetup }}
            </button>

            <!-- Controls (undo/redo/rotate) — inline on desktop -->
            <div
              class="hidden lg:flex items-center justify-center gap-2 flex-wrap
                     px-3 py-2.5 rounded-xl
                     bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700"
            >
              <button
                class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed"
                [disabled]="store.undoStack().length === 0"
                (click)="store.undo()"
              >
                ← {{ i18n.t().undo }}
              </button>
              <button
                class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300
                       hover:bg-slate-200 dark:hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed"
                [disabled]="store.redoStack().length === 0"
                (click)="store.redo()"
              >
                {{ i18n.t().redo }} →
              </button>
              <button
                class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                       bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300
                       hover:bg-indigo-200 dark:hover:bg-indigo-800/50"
                (click)="store.rotateBoard()"
              >
                ⟳ {{ i18n.t().rotateBoard }}
              </button>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ settlementText() }}
              </span>
            </div>

            <!-- Vertex detail panel — inline on desktop -->
            <div class="hidden lg:block">
              <app-vertex-detail-panel />
            </div>

            @if (!selectedVertex()) {
              <div
                class="hidden lg:flex items-center justify-center py-8 text-slate-400 dark:text-slate-600 text-sm"
              >
                {{ i18n.t().noDataYet }}
              </div>
            }
          </div>
        }
      </aside>
    </div>

    <!-- Mobile: bottom controls bar -->
    <div class="lg:hidden">
      <app-board-controls />
    </div>

    <!-- Mobile + desktop: vertex detail panel as bottom sheet on mobile -->
    <div class="lg:hidden">
      <app-vertex-detail-panel />
    </div>

    <!-- Hex info panel (both phases, mobile bottom sheet) -->
    <app-hex-info-panel />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: calc(100dvh - 69px);
      }
      @media (min-width: 1024px) {
        :host {
          height: calc(100dvh - 69px);
          max-height: calc(100dvh - 69px);
        }
      }
    `,
  ],
})
export class BoardAdvisorPageComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);

  protected readonly settlementText = () =>
    this.i18n.t().settlementsPlaced(this.store.settledVertexIds().length);

  protected readonly selectedVertex = () => {
    const id = this.store.selectedVertexId();
    return id ? (this.store.rankedVertices().find(v => v.id === id) ?? null) : null;
  };
}
