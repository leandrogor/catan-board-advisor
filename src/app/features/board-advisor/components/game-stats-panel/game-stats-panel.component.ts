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
import { GameHistoryEntry } from '../../models/game-history.model';

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

interface TooltipData {
  chartType: 'vp' | 'prod';
  isZoomed: boolean;
  turnIdx: number;
  clientX: number;
  clientY: number;
  arrowOffset: number;
  title: string;
  description: string;
  actionPlayerHex: string | null;
  players: {
    colorName: string;
    hex: string;
    valueText: string;
  }[];
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

  protected get activeTab() {
    return this.store.gameStatsPanelTab;
  }
  protected get zoomedChart() {
    return this.store.zoomedChart;
  }
  protected readonly activeTooltip = signal<TooltipData | null>(null);
  protected readonly isTooltipPinned = signal<boolean>(false);

  // New zoom and usability signals
  protected get isZoomMode() {
    return this.store.isChartZoomMode;
  }
  protected readonly scrollLeft = signal<number>(0);
  protected readonly containerWidth = signal<number>(0);
  protected readonly highlightedPlayerId = signal<string | null>(null);
  protected readonly svgWidth = signal<number>(700);
  protected readonly svgHeight = signal<number>(300);
  protected readonly svgTopMargin = computed(() => 30);

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
    return this.store.getPlayerName(color.id);
  }

  protected formatProduction(val: number): string {
    if (this.store.scoreFormat() === 'percentage') {
      return `${(val * 100).toFixed(1)}%`;
    }
    return val.toFixed(3);
  }

  /**
   * Filtered history starting from setup (index 0).
   * Ensures at least 1 baseline entry ('start') exists for rendering initial state.
   */
  protected readonly effectiveHistory = computed(() => {
    const history = this.store.gameHistory();
    if (history.length > 0) return history;

    // Fallback baseline entry if history is empty
    const scoresMap: Record<string, number> = {};
    const prodMap: Record<string, number> = {};
    for (const scoreRow of this.store.playerScores()) {
      scoresMap[scoreRow.color.id] = scoreRow.score;
      prodMap[scoreRow.color.id] = scoreRow.avgProd;
    }

    const fallbackEntry: GameHistoryEntry = {
      entryId: 'start',
      playerColorId: '',
      description: this.i18n.t().statsInitialPhase,
      scores: scoresMap,
      avgProd: prodMap,
      placements: [...this.store.placedSettlements()],
      roads: [...this.store.placedRoads()],
      devCardsPurchased: { ...this.store.devCardsPurchased() },
      devCardsPlayed: [...this.store.devCardsPlayed()],
      longestRoadOwnerId: this.store.longestRoadOwnerId(),
      largestArmyOwnerId: this.store.largestArmyOwnerId(),
      timestamp: Date.now(),
    };
    return [fallbackEntry];
  });

  /**
   * Filtered history starting from setup (index 0).
   * Generates grid coordinates for Victory Points line chart.
   */
  protected readonly vpPaths = computed(() => {
    this.i18n.lang();
    const history = this.effectiveHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores) as number[]);
    const maxScore = Math.max(10, ...allScores);

    return colors.map(color => {
      const points: TimelinePoint[] = history.map((entry, idx) => {
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        const score = entry.scores[color.id] ?? 2;
        const y = 170 - ((score - 2) / (maxScore - 2)) * 130;
        const desc =
          idx === 0
            ? this.i18n.t().statsInitialPhase
            : this.store.formatHistoryDescription(entry, history[idx - 1]);
        return { x, y, score, idx, desc, playerColorId: entry.playerColorId };
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
    this.i18n.lang();
    const history = this.effectiveHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd) as number[]);
    const maxYield = Math.max(0.5, ...allYields);

    return colors.map(color => {
      const points: ProductionPoint[] = history.map((entry, idx) => {
        const x = total <= 1 ? 250 : 50 + (idx / (total - 1)) * 410;
        const val = entry.avgProd[color.id] ?? 0;
        const y = 170 - (val / maxYield) * 130;
        const desc =
          idx === 0
            ? this.i18n.t().statsInitialPhase
            : this.store.formatHistoryDescription(entry, history[idx - 1]);
        return { x, y, val, idx, desc, playerColorId: entry.playerColorId };
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores) as number[]);
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd) as number[]);
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];
    const startText = this.i18n.t().statsStartLabel;

    if (history.length === 1) {
      return [{ label: startText, x: 250 }];
    }

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];

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
    this.i18n.lang();
    const history = this.store.gameHistory();
    if (history.length <= 1) return [];

    return history
      .slice(1)
      .map((entry, sliceIdx) => {
        const actualIdx = sliceIdx + 1;
        const prevEntry = history[actualIdx - 1];
        const playerColor = this.store.playerColors().find(c => c.id === entry.playerColorId);
        const description = this.store.formatHistoryDescription(entry, prevEntry);
        return {
          entry,
          description,
          playerColor,
        };
      })
      .reverse();
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

        roundsRange = this.i18n.t().statsRoundsRange(lower, upper);

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
    const history = this.effectiveHistory();
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
    const history = this.effectiveHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allScores = history.flatMap(e => Object.values(e.scores) as number[]);
    const maxScore = Math.max(10, ...allScores);
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        let x: number;
        if (total <= 1) {
          x = W / 2;
        } else if (isZoom) {
          x = 60 + idx * 50;
        } else {
          x = 60 + (idx / (total - 1)) * (W - 120);
        }
        const score = entry.scores[color.id] ?? 2;
        const y = H - 35 - ((score - 2) / (maxScore - 2)) * rangeY;
        return {
          x,
          y,
          score,
          idx,
          desc: idx === 0 ? this.i18n.t().statsInitialPhase : entry.description,
          playerColorId: entry.playerColorId,
        };
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
    const history = this.effectiveHistory();
    const colors = this.store.playerColors();
    if (history.length === 0) return [];

    const total = history.length;
    const allYields = history.flatMap(e => Object.values(e.avgProd) as number[]);
    const maxYield = Math.max(0.5, ...allYields);
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();
    const H = this.svgHeight();
    const topMargin = this.svgTopMargin();
    const rangeY = H - topMargin - 35;

    return colors.map(color => {
      const points = history.map((entry, idx) => {
        let x: number;
        if (total <= 1) {
          x = W / 2;
        } else if (isZoom) {
          x = 60 + idx * 50;
        } else {
          x = 60 + (idx / (total - 1)) * (W - 120);
        }
        const val = entry.avgProd[color.id] ?? 0;
        const y = H - 35 - (val / maxYield) * rangeY;
        return {
          x,
          y,
          val,
          idx,
          desc: idx === 0 ? this.i18n.t().statsInitialPhase : entry.description,
          playerColorId: entry.playerColorId,
        };
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];
    const allScores = history.flatMap(e => Object.values(e.scores) as number[]);
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];
    const allYields = history.flatMap(e => Object.values(e.avgProd) as number[]);
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
    const history = this.effectiveHistory();
    if (history.length === 0) return [];

    const total = history.length;
    const ticks: { label: string; x: number }[] = [];
    const startText = this.i18n.t().statsStartLabel;
    const isZoom = this.isZoomMode();
    const W = isZoom ? this.zoomedSvgWidth() : this.svgWidth();

    if (total <= 1) {
      return [{ label: startText, x: W / 2 }];
    }

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
    this.clearTooltip();
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
    this.clearTooltip();
    this.store.toggleChartZoomMode();
  }

  protected toggleHighlightPlayer(playerId: string): void {
    if (this.highlightedPlayerId() === playerId) {
      this.highlightedPlayerId.set(null);
    } else {
      this.highlightedPlayerId.set(playerId);
    }
  }

  protected close(): void {
    this.clearTooltip();
    this.store.gameStatsPanelOpen.set(false);
  }

  protected showTooltip(
    event: MouseEvent | TouchEvent,
    chartType: 'vp' | 'prod',
    isZoomed: boolean,
    point: TimelinePoint | ProductionPoint,
    pin = false,
  ): void {
    event.stopPropagation();
    const turnIdx = point.idx;
    const history = this.store.gameHistory();
    const entry = history[turnIdx];
    if (!entry) return;

    const startText = this.i18n.t().statsStartLabel;
    const turnLabel = turnIdx === 0 ? startText : `#${turnIdx}`;
    const titleText = `${this.i18n.t().statsMoveNum} ${turnLabel}`;

    const players: { colorName: string; hex: string; valueText: string }[] = [];
    const colors = this.store.playerColors();

    if (chartType === 'vp') {
      const targetScore = (point as TimelinePoint).score;
      colors.forEach(color => {
        const score = entry.scores[color.id] ?? 2;
        if (score === targetScore) {
          players.push({
            colorName: this.colorName(color),
            hex: color.hex,
            valueText: `${score} VP`,
          });
        }
      });
    } else {
      const targetVal = (point as ProductionPoint).val;
      colors.forEach(color => {
        const val = entry.avgProd[color.id] ?? 0;
        if (Math.abs(val - targetVal) < 1e-6) {
          players.push({
            colorName: this.colorName(color),
            hex: color.hex,
            valueText: this.formatProduction(val),
          });
        }
      });
    }

    const actionPlayer = colors.find(c => c.id === entry.playerColorId);
    const actionPlayerHex = actionPlayer ? actionPlayer.hex : null;

    const targetElement = event.currentTarget as SVGElement;
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top;

      const clampedX = Math.max(90, Math.min(window.innerWidth - 90, clientX));
      const arrowOffset = clientX - clampedX;

      this.isTooltipPinned.set(pin);
      this.activeTooltip.set({
        chartType,
        isZoomed,
        turnIdx,
        clientX: clampedX,
        clientY,
        arrowOffset,
        title: titleText,
        description: this.store.formatHistoryDescription(entry, history[turnIdx - 1]),
        actionPlayerHex,
        players,
      });
    }
  }

  protected onMouseEnterPoint(
    event: MouseEvent,
    chartType: 'vp' | 'prod',
    isZoomed: boolean,
    point: TimelinePoint | ProductionPoint,
  ): void {
    if (!this.isTooltipPinned()) {
      this.showTooltip(event, chartType, isZoomed, point, false);
    }
  }

  protected onMouseLeavePoint(): void {
    if (!this.isTooltipPinned()) {
      this.clearTooltip();
    }
  }

  protected clearTooltip(): void {
    this.activeTooltip.set(null);
    this.isTooltipPinned.set(false);
  }
}
