import { Component, inject, computed } from '@angular/core';
import {
  GameTimerService,
  formatDuration,
  formatRelativeTime,
} from '../../services/game-timer.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { TimerMilestone, TimerMilestoneKey } from '../../models/game-timer.model';

interface MilestoneRow {
  key: TimerMilestoneKey;
  label: string;
  sinceStart: string;
  /** Duration until next non-VP milestone (for top-level rows). */
  duration: string | null;
  barWidth: number; // 0–100 %
  barOffset: number; // 0–100 %
  colorClass: string;
  isVP: boolean;
  /** VP sub-milestone rows nested under game_start. */
  vpChildren?: VPRow[];
}

interface VPRow {
  key: TimerMilestoneKey;
  label: string;
  sinceStart: string;
  /** Time from this VP milestone to next VP or game_end. */
  duration: string | null;
  barWidth: number;
  barOffset: number;
  colorClass: string;
}

@Component({
  selector: 'app-game-timer-panel',
  templateUrl: './game-timer-panel.component.html',
  styleUrl: './game-timer-panel.component.scss',
  imports: [],
})
export class GameTimerPanelComponent {
  protected readonly timer = inject(GameTimerService);
  protected readonly i18n = inject(TranslationService);

  protected close(): void {
    this.timer.panelOpen.set(false);
  }

  /**
   * Top-level milestone rows.
   * VP milestones are not standalone rows — they are nested inside the `game_start` row
   * as `vpChildren`, reflecting that they are sub-events within the game phase.
   */
  protected readonly rows = computed<MilestoneRow[]>(() => {
    const milestones = this.timer.milestones();
    if (milestones.length === 0) return [];

    const startTs = milestones[0].timestamp;
    const lastM = milestones.at(-1)!;
    const endMs = this.timer.isFinished() ? lastM.timestamp - startTs : this.timer.elapsedMs();

    const totalMs = Math.max(endMs, 1);

    const colorMap: Record<string, string> = {
      setup_start: 'amber',
      placement_start: 'violet',
      game_start: 'emerald',
      game_end: 'rose',
    };
    const vpColors = ['sky', 'indigo', 'purple', 'fuchsia', 'pink', 'rose', 'orange'];

    const topLevel = milestones.filter(m => m.vp === undefined);
    const vpMilestones = milestones.filter(m => m.vp !== undefined);

    return topLevel.map((m, idx) => {
      // Next top-level milestone (skip VP ones for bar width of main phase)
      const nextTopM: TimerMilestone | undefined = topLevel[idx + 1];
      const barOffset = ((m.timestamp - startTs) / totalMs) * 100;
      const barEnd = nextTopM ? ((nextTopM.timestamp - startTs) / totalMs) * 100 : 100;
      const barWidth = Math.max(barEnd - barOffset, 0.5);

      // Duration: time from this milestone to the next top-level one
      let duration: string | null = null;
      if (nextTopM) {
        duration = formatDuration(nextTopM.timestamp - m.timestamp);
      } else if (!this.timer.isFinished()) {
        // Ongoing last phase — show live elapsed
        duration = formatDuration(this.timer.elapsedMs() - (m.timestamp - startTs));
      }
      // If finished and last top-level (game_end), no duration shown

      // Build VP children for game_start milestone
      let vpChildren: VPRow[] | undefined;
      if (m.key === 'game_start' && vpMilestones.length > 0) {
        vpChildren = vpMilestones.map((vp, vi) => {
          const nextVPorEnd: TimerMilestone | undefined =
            vpMilestones[vi + 1] ?? topLevel.find(t => t.key === 'game_end');
          const vpBarOffset = ((vp.timestamp - startTs) / totalMs) * 100;
          const vpBarEnd = nextVPorEnd ? ((nextVPorEnd.timestamp - startTs) / totalMs) * 100 : 100;
          const vpBarWidth = Math.max(vpBarEnd - vpBarOffset, 0.5);

          let vpDuration: string | null = null;
          if (nextVPorEnd) {
            vpDuration = formatDuration(nextVPorEnd.timestamp - vp.timestamp);
          } else if (!this.timer.isFinished()) {
            vpDuration = formatDuration(this.timer.elapsedMs() - (vp.timestamp - startTs));
          }

          return {
            key: vp.key,
            label: vp.label,
            sinceStart: formatRelativeTime(vp.timestamp, startTs),
            duration: vpDuration,
            barWidth: vpBarWidth,
            barOffset: vpBarOffset,
            colorClass: vpColors[(vp.vp! - 2) % vpColors.length],
          } satisfies VPRow;
        });
      }

      return {
        key: m.key,
        label: m.label,
        sinceStart: formatRelativeTime(m.timestamp, startTs),
        duration,
        barWidth,
        barOffset,
        colorClass: colorMap[m.key] ?? 'slate',
        isVP: false,
        vpChildren,
      } satisfies MilestoneRow;
    });
  });

  /** Total elapsed as formatted string. */
  protected readonly totalElapsed = computed<string>(() => {
    if (!this.timer.isStarted()) return '--:--';
    return this.timer.elapsedFormatted();
  });

  /** Returns Tailwind background class for bar chart segment. */
  protected barColorClass(color: string): string {
    const map: Record<string, string> = {
      amber: 'bg-amber-400 dark:bg-amber-500',
      violet: 'bg-violet-500 dark:bg-violet-400',
      emerald: 'bg-emerald-500 dark:bg-emerald-400',
      rose: 'bg-rose-500 dark:bg-rose-400',
      sky: 'bg-sky-500 dark:bg-sky-400',
      indigo: 'bg-indigo-500 dark:bg-indigo-400',
      purple: 'bg-purple-500 dark:bg-purple-400',
      fuchsia: 'bg-fuchsia-500 dark:bg-fuchsia-400',
      pink: 'bg-pink-500 dark:bg-pink-400',
      orange: 'bg-orange-500 dark:bg-orange-400',
      slate: 'bg-slate-400 dark:bg-slate-500',
    };
    return map[color] ?? 'bg-slate-400';
  }

  /** Returns Tailwind background class for milestone dot indicator. */
  protected dotColorClass(color: string): string {
    const map: Record<string, string> = {
      amber: 'bg-amber-400',
      violet: 'bg-violet-500',
      emerald: 'bg-emerald-500',
      rose: 'bg-rose-500',
      sky: 'bg-sky-500',
      indigo: 'bg-indigo-500',
      purple: 'bg-purple-500',
      fuchsia: 'bg-fuchsia-500',
      pink: 'bg-pink-500',
      orange: 'bg-orange-500',
      slate: 'bg-slate-400',
    };
    return map[color] ?? 'bg-slate-400';
  }

  /** Left-border accent class for VP sub-rows. */
  protected vpBorderClass(color: string): string {
    const map: Record<string, string> = {
      sky: 'border-l-sky-400',
      indigo: 'border-l-indigo-500',
      purple: 'border-l-purple-500',
      fuchsia: 'border-l-fuchsia-500',
      pink: 'border-l-pink-500',
      rose: 'border-l-rose-500',
      orange: 'border-l-orange-500',
    };
    return map[color] ?? 'border-l-slate-400';
  }
}
