import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BoardComponent } from './board.component';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ActionSnapshot } from '../../models/road-option.model';

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
    store.undoStack.set([{ historyLength: 1 } as unknown as ActionSnapshot]);

    // Touch start with 2 fingers
    const touch1 = { clientX: 200, clientY: 100 } as unknown as Touch;
    const touch2 = { clientX: 220, clientY: 100 } as unknown as Touch;
    component['onTouchStart']({
      touches: [touch1, touch2],
    } as unknown as TouchEvent);

    // Move left by 70px
    const touch1Move = { clientX: 130, clientY: 100 } as unknown as Touch;
    const touch2Move = { clientX: 150, clientY: 100 } as unknown as Touch;
    component['onTouchMove']({
      touches: [touch1Move, touch2Move],
    } as unknown as TouchEvent);

    // Touch end
    component['onTouchEnd']();

    expect(store.undo).toHaveBeenCalled();
    expect(component['gestureToast']()?.action).toBe('undo');
  });

  it('should trigger store.redo() on two-finger right swipe when canRedo is true', () => {
    spyOn(store, 'redo');
    store.appPhase.set('game');
    store.redoStack.set([{ historyLength: 1 } as unknown as ActionSnapshot]);

    // Touch start with 2 fingers
    const touch1 = { clientX: 100, clientY: 100 } as unknown as Touch;
    const touch2 = { clientX: 120, clientY: 100 } as unknown as Touch;
    component['onTouchStart']({
      touches: [touch1, touch2],
    } as unknown as TouchEvent);

    // Move right by 70px
    const touch1Move = { clientX: 170, clientY: 100 } as unknown as Touch;
    const touch2Move = { clientX: 190, clientY: 100 } as unknown as Touch;
    component['onTouchMove']({
      touches: [touch1Move, touch2Move],
    } as unknown as TouchEvent);

    // Touch end
    component['onTouchEnd']();

    expect(store.redo).toHaveBeenCalled();
    expect(component['gestureToast']()?.action).toBe('redo');
  });

  it('should ignore gesture if pinch-to-zoom distance changes significantly', () => {
    spyOn(store, 'undo');
    store.appPhase.set('game');
    store.undoStack.set([{ historyLength: 1 } as unknown as ActionSnapshot]);

    const touch1 = { clientX: 100, clientY: 100 } as unknown as Touch;
    const touch2 = { clientX: 120, clientY: 100 } as unknown as Touch; // initial dist = 20px
    component['onTouchStart']({
      touches: [touch1, touch2],
    } as unknown as TouchEvent);

    // Move fingers far apart (pinch zoom)
    const touch1Move = { clientX: 50, clientY: 100 } as unknown as Touch;
    const touch2Move = { clientX: 200, clientY: 100 } as unknown as Touch; // dist = 150px
    component['onTouchMove']({
      touches: [touch1Move, touch2Move],
    } as unknown as TouchEvent);

    component['onTouchEnd']();

    expect(store.undo).not.toHaveBeenCalled();
  });
});
