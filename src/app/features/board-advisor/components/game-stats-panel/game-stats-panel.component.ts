import {
  Component,
  inject,
  computed,
  signal,
  effect,
  ElementRef,
  viewChild,
  afterNextRender,
  Injector,
} from '@angular/core';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { PlayerColor } from '../../models/player-color.model';

interface TimelinePoint {
  x: number;
  y: number;
  score: number;
  idx: number;
  desc: string;
  playerColorId: string;
}

interface ProductionPoint {
  x: number;
  y: number;
  val: number;
  idx: number;
  desc: string;
  playerColorId: string;
}

@Component({
  selector: 'app-game-stats-panel',
  templateUrl: './game-stats-panel.component.html',
  styleUrl: './game-stats-panel.component.scss',
  imports: [],
})
export class GameStatsPanelComponent {
  protected readonly store = inject(BoardStateStore);
  protected readonly i18n = inject(TranslationService);
  private readonly injector = inject(Injector);

  protected readonly activeTab = signal<'progress' | 'projection'>('progress');
  protected readonly zoomedChart = signal<'vp' | 'prod' | null>(null);

  // New zoom and usability signals
  protected readonly isZoomMode = signal<boolean>(false);
  protected readonly scrollLeft = signal<number>(0);
  protected readonly containerWidth = signal<number>(0);
  protected readonly highlightedPlayerId = signal<string | null>(null);
  protected readonly svgWidth = signal<number>(700);
  protected readonly svgHeight = signal<number>(300);
  protected readonly svgTopMargin = computed(() => {
    return this.svgWidth() < 640 ? 150 : 95;
  });

  // ViewChild reference to zoomContainer
  protected readonly zoomContainer = viewChild<ElementRef<HTMLDivElement>>('zoomContainer');

  constructor() {
    effect(() => {
      const isZoom = this.isZoomMode();
      const chart = this.zoomedChart();
      const containerEl = this.zoomContainer()?.nativeElement;

      if (chart && containerEl) {
        afterNextRender(
          () => {
            if (isZoom) {
              containerEl.scrollLeft = containerEl.scrollWidth;
            } else {
              containerEl.scrollLeft = 0;
            }
            this.scrollLeft.set(containerEl.scrollLeft);
            this.containerWidth.set(containerEl.clientWidth);
          },
          { injector: this.injector },
        );
      }
    });

    effect(onCleanup => {
      const containerEl = this.zoomContainer()?.nativeElement;
      if (containerEl) {
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            requestAnimationFrame(() => {
              this.svgWidth.set(entry.contentRect.width);
              this.svgHeight.set(entry.contentRect.height);
            });
          }
        });
        observer.observe(containerEl);

        onCleanup(() => {
          observer.disconnect();
        });
      }
    });
  }

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
    return map[color.id] ?? color.id;
  }

  protected formatProduction(val: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(val * 100).toFixed(1)}%`;
    }
    return val.toFixed(3);
  }

  /**
   * Filtered history starting from setup (index 0).
   * Generates grid coordinates for Victory Points line chart.
   */
  protected readonly vpPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    return colors.map(color => {
      const points: TimelinePoint[] = history.map((entry, idx) => {
        // Horizontal mapping: 50px margin left, 410px span (total viewBox width 500)
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        // Vertical mapping: Y=170 is VP=2, Y=30 is maxScore.
        const score = entry.scores[color.id] ?? 2;
        const y = 170 - ((score - 2) / (maxScore - 2)) * 130;
        return { x, y, score, idx, desc: entry.description, playerColorId: entry.playerColorId };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Generates grid coordinates for expected production engine line chart.
   */
  protected readonly prodPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    return colors.map(color => {
      const points: ProductionPoint[] = history.map((entry, idx) => {
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        const val = entry.avgProd[color.id] ?? 0;
        // Vertical mapping: Y=170 is Prod=0, Y=30 is maxYield.
        const y = 170 - (val / maxYield) * 130;
        return { x, y, val, idx, desc: entry.description, playerColorId: entry.playerColorId };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Dynamic horizontal grids for the VP chart.
   */
  protected readonly vpGridLines = computed(() => {
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);

    const steps = [2, 4, 6, 8, 10];
    if (maxScore > 10) {
      steps.push(maxScore);
    }
    const uniqueSteps = Array.from(new Set(steps)).sort((a, b) => a - b);

    return uniqueSteps.map(score => {
      const y = 170 - ((score - 2) / (maxScore - 2)) * 130;
      return { score, y };
    });
  });

  /**
   * Dynamic horizontal grids for the production chart.
   */
  protected readonly prodGridLines = computed(() => {
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);

    // Provide 4 divisions
    const stepVal = maxYield / 4;
    const steps = [0, stepVal, stepVal * 2, stepVal * 3, maxYield];

    return steps.map(val => {
      const y = 170 - (val / maxYield) * 130;
      return { val, y };
    });
  });

  /**
   * Dynamic X-axis tick positions and labels.
   */
  protected readonly xAxisTicks = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];
    const startText = this.i18n.lang() === 'es' ? 'Inicio' : 'Start';

    if (total <= 6) {
      history.forEach((_, idx) => {
        const x = 50 + (idx / (total - 1)) * 410;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    } else {
      const indices = [0, Math.floor(total * 0.33), Math.floor(total * 0.66), total - 1];
      const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
      uniqueIndices.forEach(idx => {
        const x = 50 + (idx / (total - 1)) * 410;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    }
    return ticks;
  });

  /**
   * Reverse chronological event log of the active game.
   */
  protected readonly gameLog = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    // Skip start entry, show newest first
    const entries = history.slice(1);
    entries.reverse();
    return entries.map(entry => {
      const playerColor = this.store.playerColors().find(c => c.id === entry.playerColorId);
      return {
        entry,
        playerColor,
      };
    });
  });

  /**
   * Qualitative engine strength and estimated rounds projection.
   */
  protected readonly projections = computed(() => {
    const scores = this.store.playerScores();
    const playerCount = this.store.playerCount();

    const list = scores.map(row => {
      const currentVP = row.score;
      const vpsNeeded = Math.max(0, 10 - currentVP);
      const avgProd = row.avgProd;
      const rRound = avgProd * playerCount;

      let roundsRange = '—';
      let speedClass: string;
      let speedTextKey:
        'statsEngineSlow' | 'statsEngineMedium' | 'statsEngineFast' | 'statsRoundsWon';
      const sortRounds = rRound >= 0.05 ? vpsNeeded / rRound : Infinity;

      if (vpsNeeded === 0) {
        roundsRange = '0';
        speedClass = 'won';
        speedTextKey = 'statsRoundsWon'; // Won! 🏆
      } else if (rRound >= 0.05) {
        const minRounds = Math.round((vpsNeeded * 6.0) / rRound);
        const maxRounds = Math.round((vpsNeeded * 10.5) / rRound);
        const lower = Math.max(1, minRounds);
        const upper = Math.max(lower + 1, maxRounds);

        const isEs = this.i18n.lang() === 'es';
        roundsRange = isEs ? `${lower} - ${upper} rondas` : `${lower} - ${upper} rounds`;

        if (rRound >= 3.0) {
          speedClass = 'fast';
          speedTextKey = 'statsEngineFast';
        } else if (rRound >= 1.5) {
          speedClass = 'medium';
          speedTextKey = 'statsEngineMedium';
        } else {
          speedClass = 'slow';
          speedTextKey = 'statsEngineSlow';
        }
      } else {
        speedClass = 'slow';
        speedTextKey = 'statsEngineSlow';
      }

      return {
        color: row.color,
        score: currentVP,
        avgProd,
        roundsRange,
        speedClass,
        speedTextKey,
        sortRounds,
      };
    });

    list.sort((a, b) => {
      if (a.sortRounds !== b.sortRounds) {
        return a.sortRounds - b.sortRounds;
      }
      return b.avgProd - a.avgProd;
    });

    return list;
  });

  /**
   * Bar dimensions for Expected Production Comparison Bar Chart
   */
  protected readonly expectedYieldBars = computed(() => {
    const projList = this.projections();
    if (projList.length === 0) return [];

    const maxProd = Math.max(0.5, ...projList.map(s => s.avgProd));

    return projList.map(p => {
      const pct = (p.avgProd / maxProd) * 100;
      const scoreRow = this.store.playerScores().find(s => s.color.id === p.color.id);
      const settlements = scoreRow?.settlementsCount ?? 0;
      const cities = scoreRow?.citiesCount ?? 0;

      return {
        color: p.color,
        val: p.avgProd,
        pct,
        settlements,
        cities,
      };
    });
  });

  protected getSpeedLabel(
    key: 'statsEngineSlow' | 'statsEngineMedium' | 'statsEngineFast' | 'statsRoundsWon',
  ): string {
    const t = this.i18n.t();
    const map: Record<typeof key, string> = {
      statsEngineSlow: t.statsEngineSlow,
      statsEngineMedium: t.statsEngineMedium,
      statsEngineFast: t.statsEngineFast,
      statsRoundsWon: t.statsRoundsWon,
    };
    return map[key];
  }

  /**
   * Zoomed SVG total width in pixels when in zoom mode.
   */
  protected readonly zoomedSvgWidth = computed(() => {
    const history = this.store.gameHistory();
    const totalTurnos = history.length;
    if (totalTurnos <= 1) return 700;
    return 120 + (totalTurnos - 1) * 50;
  });

  /**
   * Zoomed horizontal axis end coordinate.
   */
  protected readonly zoomXEnd = computed(() => {
    if (this.isZoomMode()) {
      return this.zoomedSvgWidth() - 60;
    }
    return this.svgWidth() - 60;
  });

  /**
   * Zoomed VP lines and paths
   */
  protected readonly zoomVpPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        let x: number;
        if (isZoom) {
          x = 60 + idx * 50;
        } else if (total <= 1) {
          x = W / 2;
        } else {
          x = 60 + (idx / (total - 1)) * (W - 120);
        }
        const score = entry.scores[color.id] ?? 2;
        const y = H - 35 - ((score - 2) / (maxScore - 2)) * rangeY;
        return { x, y, score, idx };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Zoomed production lines and paths
   */
  protected readonly zoomProdPaths = computed(() => {
    const history = this.store.gameHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        let x: number;
        if (isZoom) {
          x = 60 + idx * 50;
        } else if (total <= 1) {
          x = W / 2;
        } else {
          x = 60 + (idx / (total - 1)) * (W - 120);
        }
        const val = entry.avgProd[color.id] ?? 0;
        const y = H - 35 - (val / maxYield) * rangeY;
        return { x, y, val, idx };
      });

      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

      return {
        color,
        points,
        pathD,
      };
    });
  });

  /**
   * Zoomed VP grid lines
   */
  protected readonly zoomVpGridLines = computed(() => {
    const lines = this.vpGridLines();
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores));
    const maxScore = Math.max(10, ...allScores);
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return lines.map(line => {
      const y = H - 35 - ((line.score - 2) / (maxScore - 2)) * rangeY;
      return { score: line.score, y };
    });
  });

  /**
   * Zoomed production grid lines
   */
  protected readonly zoomProdGridLines = computed(() => {
    const lines = this.prodGridLines();
    const history = this.store.gameHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd));
    const maxYield = Math.max(0.5, ...allYields);
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return lines.map(line => {
      const y = H - 35 - (line.val / maxYield) * rangeY;
      return { val: line.val, y };
    });
  });

  /**
   * Zoomed X-axis ticks
   */
  protected readonly zoomXAxisTicks = computed(() => {
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];
    const startText = this.i18n.lang() === 'es' ? 'Inicio' : 'Start';
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();

    if (isZoom) {
      history.forEach((_, idx) => {
        const x = 60 + idx * 50;
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    } else if (total <= 10) {
      history.forEach((_, idx) => {
        const x = 60 + (idx / (total - 1)) * (W - 120);
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    } else {
      const indices = [
        0,
        Math.floor(total * 0.25),
        Math.floor(total * 0.5),
        Math.floor(total * 0.75),
        total - 1,
      ];
      const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
      uniqueIndices.forEach(idx => {
        const x = 60 + (idx / (total - 1)) * (W - 120);
        const label = idx === 0 ? startText : `#${idx}`;
        ticks.push({ label, x });
      });
    }
    return ticks;
  });

  private scrollTicking = false;

  protected onScroll(event: Event): void {
    const container = event.target as HTMLElement;
    if (!this.scrollTicking) {
      this.scrollTicking = true;
      requestAnimationFrame(() => {
        this.scrollLeft.set(container.scrollLeft);
        this.containerWidth.set(container.clientWidth);
        this.scrollTicking = false;
      });
    }
  }

  protected toggleZoomMode(): void {
    this.isZoomMode.update(z => !z);
  }

  protected toggleHighlightPlayer(playerId: string): void {
    if (this.highlightedPlayerId() === playerId) {
      this.highlightedPlayerId.set(null);
    } else {
      this.highlightedPlayerId.set(playerId);
    }
  }

  protected close(): void {
    this.store.gameStatsPanelOpen.set(false);
  }
}
