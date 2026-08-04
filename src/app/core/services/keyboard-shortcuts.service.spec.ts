import { TestBed } from '@angular/core/testing';
import { KeyboardShortcutsService } from './keyboard-shortcuts.service';
import { BoardStateStore } from '../../features/board-advisor/services/board-state.store';
import { ThemeService } from './theme.service';
import { Vertex } from '../../features/board-advisor/models/vertex.model';

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

  it('should deselect hex on Escape key', () => {
    spyOn(store, 'selectHex');
    store.selectedHexId.set('hex-1');
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(event);
    expect(store.selectHex).toHaveBeenCalledWith(null);
  });

  it('should deselect vertex on Escape key', () => {
    spyOn(store, 'selectVertex');
    store.selectedVertexId.set('vertex-1');
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(event);
    expect(store.selectVertex).toHaveBeenCalledWith(null);
  });

  it('should handle both Enter and Space to toggle chart zoom mode when chart is zoomed', () => {
    spyOn(store, 'toggleChartZoomMode');
    store.zoomedChart.set('vp');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(store.toggleChartZoomMode).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(store.toggleChartZoomMode).toHaveBeenCalledTimes(2);
  });

  it('should handle both Enter and Space to start road selection in placement phase', () => {
    spyOn(store, 'startSelectingRoad');
    spyOn(store, 'isSetupComplete').and.returnValue(false);
    store.appPhase.set('results');
    store.selectedVertexId.set('vertex-5');
    store.isSelectingRoad.set(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(store.startSelectingRoad).toHaveBeenCalledWith('vertex-5');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(store.startSelectingRoad).toHaveBeenCalledWith('vertex-5');
  });

  it('should handle both Enter and Space to start game phase when setup is complete', () => {
    spyOn(store, 'startGamePhase');
    spyOn(store, 'isSetupComplete').and.returnValue(true);
    store.appPhase.set('results');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(store.startGamePhase).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    expect(store.startGamePhase).toHaveBeenCalledTimes(2);
  });

  it('should select ranked vertex or fallback to highest lower rank when key rank has no matches', () => {
    spyOn(store, 'isSetupComplete').and.returnValue(false);
    spyOn(store, 'selectVertex');
    store.appPhase.set('results');

    const mockVertices = [
      { id: 'v-1', rank: 1 },
      { id: 'v-2', rank: 2 },
      { id: 'v-3', rank: 3 },
      { id: 'v-4a', rank: 4 },
      { id: 'v-4b', rank: 4 },
      { id: 'v-6', rank: 6 },
    ] as Vertex[];
    spyOn(store, 'rankedVertices').and.returnValue(mockVertices);

    // Pressing '4' when nothing is selected selects 'v-4a'
    store.selectedVertexId.set(null);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', cancelable: true }));
    expect(store.selectVertex).toHaveBeenCalledWith('v-4a');

    // Pressing '5' when 'v-4a' is selected falls back to rank 4 and cycles to 'v-4b'
    store.selectedVertexId.set('v-4a');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', cancelable: true }));
    expect(store.selectVertex).toHaveBeenCalledWith('v-4b');
  });
});
