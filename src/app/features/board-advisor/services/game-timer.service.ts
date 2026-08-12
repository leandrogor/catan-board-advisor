import { Injectable, signal, computed } from '@angular/core';
import { GameTimerState, TimerMilestoneKey } from '../models/game-timer.model';

@Injectable({ providedIn: 'root' })
export class GameTimerService {
  readonly state = signal<GameTimerState>({ milestones: [], isRunning: false });
  readonly panelOpen = signal<boolean>(false);

  /** Current elapsed time in ms since setup_start (or 0 if not started). */
  readonly elapsedMs = signal<number>(0);

  private tickInterval: ReturnType<typeof setInterval> | null = null;

  // ── Derived computed signals ──────────────────────────────────────────────

  readonly isStarted = computed(() => this.state().milestones.length > 0);
  readonly isRunning = computed(() => this.state().isRunning);
  readonly isFinished = computed(() => this.state().milestones.some(m => m.key === 'game_end'));

  readonly milestones = computed(() => this.state().milestones);

  /**
   * Returns the maximum VP milestone recorded (e.g. 5 for vp_5).
   * Used to decide which VP milestones to show/remove reactively.
   */
  readonly maxVpMilestone = computed<number>(() => {
    let max = 2;
    for (const m of this.state().milestones) {
      if (m.vp !== undefined && m.vp > max) max = m.vp;
    }
    return max;
  });

  // ── Formatted elapsed ─────────────────────────────────────────────────────

  readonly elapsedFormatted = computed<string>(() => {
    const ms = this.elapsedMs();
    return formatDuration(ms);
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Starts the setup phase timer. Idempotent if already started. */
  startSetup(label: string): void {
    if (this.isStarted()) return;
    const now = Date.now();
    this.state.update(s => ({
      ...s,
      isRunning: true,
      milestones: [{ key: 'setup_start', label, timestamp: now }],
    }));
    this.startTick(now);
  }

  /** Records the beginning of the placement (initial settlement) phase. */
  startPlacement(label: string): void {
    if (!this.isStarted()) return;
    if (this.hasMilestone('placement_start')) return;
    const now = Date.now();
    this.state.update(s => ({
      ...s,
      milestones: [...s.milestones, { key: 'placement_start', label, timestamp: now }],
    }));
  }

  /** Records the beginning of the active game phase and optionally the initial 2 VP milestone. */
  startGame(label: string, vp2Label?: string): void {
    if (!this.isStarted()) return;
    if (this.hasMilestone('game_start')) return;
    const now = Date.now();
    this.state.update(s => {
      const newMilestones: typeof s.milestones = [
        ...s.milestones,
        { key: 'game_start', label, timestamp: now },
      ];
      if (vp2Label) {
        newMilestones.push({ key: 'vp_2', label: vp2Label, timestamp: now, vp: 2 });
      }
      return {
        ...s,
        milestones: newMilestones,
      };
    });
  }

  /**
   * Records a VP milestone. Only records if this VP level hasn't been recorded yet.
   * VP milestones track the maximum VP any player has reached (2–9).
   */
  recordVP(vp: number, label: string, customTimestamp?: number): void {
    if (!this.isStarted()) return;
    if (vp < 2 || vp > 9) return;
    const key: TimerMilestoneKey = `vp_${vp}`;
    if (this.hasMilestone(key)) return;
    const now = customTimestamp ?? Date.now();
    this.state.update(s => ({
      ...s,
      milestones: [...s.milestones, { key, label, timestamp: now, vp }],
    }));
  }

  /**
   * Removes all VP milestones with VP >= the given value.
   * Used when an action is undone and the max score drops below a milestone.
   */
  revokeVPMilestonesAbove(vp: number): void {
    this.state.update(s => ({
      ...s,
      milestones: s.milestones.filter(m => m.vp === undefined || m.vp <= vp),
    }));
  }

  /** Records the end of the game and stops the timer. */
  endGame(label: string): void {
    if (!this.isStarted()) return;
    if (this.hasMilestone('game_end')) return;
    const now = Date.now();
    this.state.update(s => ({
      ...s,
      isRunning: false,
      milestones: [...s.milestones, { key: 'game_end', label, timestamp: now }],
    }));
    this.elapsedMs.set(now - this.getSetupStartTime()!);
    this.stopTick();
  }

  /** Resets the timer completely. */
  reset(): void {
    this.stopTick();
    this.state.set({ milestones: [], isRunning: false });
    this.elapsedMs.set(0);
  }

  /**
   * Restores a previously serialized timer state (from snapshot/localStorage).
   * Re-computes the elapsed time and restarts the tick if the timer was running.
   */
  restoreState(saved: GameTimerState): void {
    this.stopTick();
    // Mark as paused while restoring (a finished game stays finished)
    const isRunning = saved.isRunning && !saved.milestones.some(m => m.key === 'game_end');
    this.state.set({ milestones: [...saved.milestones], isRunning });

    const startTs = saved.milestones[0]?.timestamp ?? null;
    if (startTs !== null) {
      const now = Date.now();
      if (isRunning) {
        // Game was mid-session: elapsed = now - setupStart (time kept ticking)
        this.elapsedMs.set(now - startTs);
        this.startTick(startTs);
      } else {
        // Finished: elapsed = last milestone - start
        const lastTs = saved.milestones.at(-1)?.timestamp ?? now;
        this.elapsedMs.set(lastTs - startTs);
      }
    }
  }

  /** Opens/closes the timer panel. */
  togglePanel(): void {
    this.panelOpen.update(v => !v);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private hasMilestone(key: TimerMilestoneKey): boolean {
    return this.state().milestones.some(m => m.key === key);
  }

  getSetupStartTime(): number | null {
    return this.state().milestones.find(m => m.key === 'setup_start')?.timestamp ?? null;
  }

  private startTick(startedAt: number): void {
    this.stopTick();
    this.tickInterval = setInterval(() => {
      if (this.state().isRunning) {
        this.elapsedMs.set(Date.now() - startedAt);
      }
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Returns the duration in ms between two consecutive milestones,
   * or null if the end milestone doesn't exist yet.
   */
  getDurationBetween(fromKey: TimerMilestoneKey, toKey: TimerMilestoneKey): number | null {
    const from = this.state().milestones.find(m => m.key === fromKey);
    const to = this.state().milestones.find(m => m.key === toKey);
    if (!from || !to) return null;
    return to.timestamp - from.timestamp;
  }

  /**
   * Returns duration from a milestone to "now" (current elapsed),
   * or to game_end if finished.
   */
  getDurationFrom(fromKey: TimerMilestoneKey): number | null {
    const from = this.state().milestones.find(m => m.key === fromKey);
    if (!from) return null;
    const endM = this.state().milestones.find(m => m.key === 'game_end');
    const endTime = endM ? endM.timestamp : Date.now();
    return endTime - from.timestamp;
  }
}

/** Formats a duration in ms to MM:SS or HH:MM:SS if >= 1 hour. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/** Formats an absolute timestamp as HH:MM:SS relative to a start time. */
export function formatRelativeTime(timestampMs: number, startMs: number): string {
  return formatDuration(timestampMs - startMs);
}
