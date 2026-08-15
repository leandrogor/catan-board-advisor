import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WritableSignal } from '@angular/core';
import { BoardComponent } from './board.component';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ActionSnapshot } from '../../models/road-option.model';
import { SimulationResult } from '../../models/simulation-result.model';

function createMockSnapshot(overrides: Partial<ActionSnapshot> = {}): ActionSnapshot {
  return {
    settled: [],
    roads: [],
    turnIndex: 0,
    ...overrides,
  };
}

function createMockTouch(clientX: number, clientY: number): Touch {
  return { clientX, clientY } as Partial<Touch> as Touch;
}

function createMockTouchEvent(touches: Touch[]): TouchEvent {
  const touchList: TouchList = Object.assign(touches, {
    item: (i: number) => touches[i] ?? null,
  });
  return { touches: touchList } as Partial<TouchEvent> as TouchEvent;
}

describe('BoardComponent - 2-Finger Touch Gestures', () => {
  let component: BoardComponent;
  let fixture: ComponentFixture<BoardComponent>;
  let store: BoardStateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [BoardStateStore, TranslationService, ThemeService],
    });

    fixture = TestBed.createComponent(BoardComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(BoardStateStore);
    fixture.detectChanges();
  });

  it('should create BoardComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should trigger store.undo() on two-finger left swipe when canUndo is true', () => {
    spyOn(store, 'undo');
    store.appPhase.set('game');
    store.undoStack.set([createMockSnapshot({ historyLength: 1 })]);

    // Touch start with 2 fingers
    const touch1 = createMockTouch(200, 100);
    const touch2 = createMockTouch(220, 100);
    component['onTouchStart'](createMockTouchEvent([touch1, touch2]));

    // Move left by 70px
    const touch1Move = createMockTouch(130, 100);
    const touch2Move = createMockTouch(150, 100);
    component['onTouchMove'](createMockTouchEvent([touch1Move, touch2Move]));

    // Touch end
    component['onTouchEnd']();

    expect(store.undo).toHaveBeenCalled();
    expect(component['gestureToast']()?.action).toBe('undo');
  });

  it('should trigger store.redo() on two-finger right swipe when canRedo is true', () => {
    spyOn(store, 'redo');
    store.appPhase.set('game');
    store.redoStack.set([createMockSnapshot({ historyLength: 1 })]);

    // Touch start with 2 fingers
    const touch1 = createMockTouch(100, 100);
    const touch2 = createMockTouch(120, 100);
    component['onTouchStart'](createMockTouchEvent([touch1, touch2]));

    // Move right by 70px
    const touch1Move = createMockTouch(170, 100);
    const touch2Move = createMockTouch(190, 100);
    component['onTouchMove'](createMockTouchEvent([touch1Move, touch2Move]));

    // Touch end
    component['onTouchEnd']();

    expect(store.redo).toHaveBeenCalled();
    expect(component['gestureToast']()?.action).toBe('redo');
  });

  it('should ignore gesture if pinch-to-zoom distance changes significantly', () => {
    spyOn(store, 'undo');
    store.appPhase.set('game');
    store.undoStack.set([createMockSnapshot({ historyLength: 1 })]);

    const touch1 = createMockTouch(100, 100);
    const touch2 = createMockTouch(120, 100); // initial dist = 20px
    component['onTouchStart'](createMockTouchEvent([touch1, touch2]));

    // Move fingers far apart (pinch zoom)
    const touch1Move = createMockTouch(50, 100);
    const touch2Move = createMockTouch(200, 100); // dist = 150px
    component['onTouchMove'](createMockTouchEvent([touch1Move, touch2Move]));

    component['onTouchEnd']();

    expect(store.undo).not.toHaveBeenCalled();
  });

  it('should increment toast counter on consecutive swipes of the same action', () => {
    store.appPhase.set('game');
    store.undoStack.set([
      createMockSnapshot({ historyLength: 1 }),
      createMockSnapshot({ historyLength: 2 }),
    ]);

    // First swipe
    component['showGestureToast']('undo');
    expect(component['gestureToast']()?.count).toBe(1);

    // Second swipe
    component['showGestureToast']('undo');
    expect(component['gestureToast']()?.count).toBe(2);

    // Switch action
    component['showGestureToast']('redo');
    expect(component['gestureToast']()?.count).toBe(1);
  });

  describe('displayVertices filtering', () => {
    it('should show all unblocked vertices in setup phase', () => {
      store.appPhase.set('setup');
      const displayed = component['displayVertices']();
      expect(displayed.length).toBeGreaterThan(0);
    });

    it('should filter zero-score vertices when showZeroScores is false after simulation', () => {
      store.appPhase.set('results');
      (
        store as object as {
          _simulationResult: WritableSignal<Partial<SimulationResult> | null>;
        }
      )._simulationResult.set({
        maxRawScore: 10,
        resourceMap: new Map([
          ['v-1', 5],
          ['v-2', 0],
        ]),
      });

      store.showZeroScores.set(true);
      const allDisplayed = component['displayVertices']();

      store.showZeroScores.set(false);
      const filteredDisplayed = component['displayVertices']();

      expect(filteredDisplayed.length).toBeLessThan(allDisplayed.length);
      expect(filteredDisplayed.some(v => v.id === 'v-2')).toBeFalse();
    });
  });

  describe('isTiedWithSelected', () => {
    it('should return true for peer vertices sharing the same rank when a vertex is selected', () => {
      store.appPhase.set('results');
      store.setEvaluationMode('theoretical');

      const ranked = store.rankedVertices();
      const eligible = ranked.filter(v => (v.rawScore ?? 0) > 0 && !v.isBlocked && !v.isOccupied);

      // Group by rank
      const rankGroups = new Map<number, typeof eligible>();
      for (const v of eligible) {
        if (v.rank) {
          const list = rankGroups.get(v.rank) ?? [];
          list.push(v);
          rankGroups.set(v.rank, list);
        }
      }

      // Find a rank with at least 2 vertices
      const tiedGroup = Array.from(rankGroups.values()).find(g => g.length > 1);
      expect(tiedGroup).toBeDefined();

      if (tiedGroup && tiedGroup.length >= 2) {
        const v1 = tiedGroup[0];
        const v2 = tiedGroup[1];

        // Select v1
        store.selectedVertexId.set(v1.id);

        // v1 itself should NOT be considered tied-peer of itself (it is selected)
        expect(component['isTiedWithSelected'](v1)).toBeFalse();
        // v2 shares the rank with selected v1 -> should return true
        expect(component['isTiedWithSelected'](v2)).toBeTrue();

        // Any vertex with a different rank should return false
        const otherRankVertex = eligible.find(v => v.rank !== v1.rank);
        if (otherRankVertex) {
          expect(component['isTiedWithSelected'](otherRankVertex)).toBeFalse();
        }
      }
    });
  });
});
