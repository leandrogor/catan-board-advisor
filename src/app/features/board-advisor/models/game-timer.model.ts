export type TimerMilestoneKey =
  'setup_start' | 'placement_start' | 'game_start' | `vp_${number}` | 'game_end';

export interface TimerMilestone {
  key: TimerMilestoneKey;
  label: string;
  timestamp: number; // Date.now() in ms
  vp?: number; // only for vp_N milestones
}

export interface GameTimerState {
  milestones: TimerMilestone[];
  isRunning: boolean;
}
