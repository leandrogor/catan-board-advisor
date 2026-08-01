import { TestBed } from '@angular/core/testing';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';
import { BoardStateStore } from '../../features/board-advisor/services/board-state.store';
import { ThemeService } from './theme.service';

describe('KeyboardShortcutsService', () => {
  let service: KeyboardShortcutsService;
  let store: BoardStateStore;
  let theme: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeyboardShortcutsService);
    store = TestBed.inject(BoardStateStore);
    theme = TestBed.inject(ThemeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should toggle settings state', () => {
    expect(service.settingsOpen()).toBeFalse();
    service.toggleSettings();
    expect(service.settingsOpen()).toBeTrue();
    service.toggleSettings();
    expect(service.settingsOpen()).toBeFalse();
  });

  it('should handle Ctrl+Z for undo', () => {
    spyOn(store, 'undo');
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(store.undo).toHaveBeenCalled();
  });

  it('should handle Ctrl+Y for redo', () => {
    spyOn(store, 'redo');
    const event = new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(store.redo).toHaveBeenCalled();
  });

  it('should handle R key to rotate board', () => {
    spyOn(store, 'rotateBoard');
    const event = new KeyboardEvent('keydown', { key: 'r', cancelable: true });
    window.dispatchEvent(event);
    expect(store.rotateBoard).toHaveBeenCalled();
  });

  it('should handle D key to toggle dark mode', () => {
    spyOn(theme, 'toggle');
    const event = new KeyboardEvent('keydown', { key: 'd', cancelable: true });
    window.dispatchEvent(event);
    expect(theme.toggle).toHaveBeenCalled();
  });

  it('should handle player count keys 3-6 in setup phase', () => {
    store.resetToSetup();
    spyOn(store, 'setPlayerCount');
    const event = new KeyboardEvent('keydown', { key: '4', cancelable: true });
    window.dispatchEvent(event);
    expect(store.setPlayerCount).toHaveBeenCalledWith(4);
  });
});
