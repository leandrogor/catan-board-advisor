import { TestBed } from '@angular/core/testing';
import {
  GameTimerService,
  formatCompactDuration,
  formatDuration,
  formatRelativeTime,
} from './game-timer.service';

describe('GameTimerService and Formatting Utils', () => {
  describe('formatCompactDuration', () => {
    it('should format durations under 1 minute as seconds only', () => {
      expect(formatCompactDuration(0)).toBe('0s');
      expect(formatCompactDuration(-500)).toBe('0s');
      expect(formatCompactDuration(999)).toBe('0s');
      expect(formatCompactDuration(1000)).toBe('1s');
      expect(formatCompactDuration(10_000)).toBe('10s');
      expect(formatCompactDuration(30_000)).toBe('30s');
      expect(formatCompactDuration(59_000)).toBe('59s');
      expect(formatCompactDuration(59_999)).toBe('59s');
    });

    it('should format durations from 1 minute up to 59 minutes as minutes only', () => {
      expect(formatCompactDuration(60_000)).toBe('1m');
      expect(formatCompactDuration(61_000)).toBe('1m');
      expect(formatCompactDuration(180_000)).toBe('3m');
      expect(formatCompactDuration(3540_000)).toBe('59m');
      expect(formatCompactDuration(3599_000)).toBe('59m');
    });

    it('should format durations of 1 hour or more with hours and optional minutes', () => {
      // Exactly 1 hour
      expect(formatCompactDuration(3600_000)).toBe('1h');
      // 1 hour and seconds only -> "1h"
      expect(formatCompactDuration(3659_000)).toBe('1h');
      // 1 hour and 1 minute
      expect(formatCompactDuration(3660_000)).toBe('1h 1m');
      // 1 hour and 59 minutes
      expect(formatCompactDuration(7140_000)).toBe('1h 59m');
      // Exactly 2 hours
      expect(formatCompactDuration(7200_000)).toBe('2h');
      // 2 hours and 3 minutes
      expect(formatCompactDuration(7380_000)).toBe('2h 3m');
    });
  });

  describe('formatDuration', () => {
    it('should format standard durations as MM:SS and HH:MM:SS', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(5000)).toBe('00:05');
      expect(formatDuration(65000)).toBe('01:05');
      expect(formatDuration(3665000)).toBe('01:01:05');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative difference', () => {
      expect(formatRelativeTime(5000, 2000)).toBe('00:03');
    });
  });

  describe('GameTimerService', () => {
    let service: GameTimerService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [GameTimerService],
      });
      service = TestBed.inject(GameTimerService);
    });

    afterEach(() => {
      service.reset();
    });

    it('should compute compactElapsedFormatted matching elapsedMs', () => {
      expect(service.compactElapsedFormatted()).toBe('0s');

      service.elapsedMs.set(45_000);
      expect(service.compactElapsedFormatted()).toBe('45s');

      service.elapsedMs.set(120_000);
      expect(service.compactElapsedFormatted()).toBe('2m');

      service.elapsedMs.set(3660_000);
      expect(service.compactElapsedFormatted()).toBe('1h 1m');
    });
  });
});
