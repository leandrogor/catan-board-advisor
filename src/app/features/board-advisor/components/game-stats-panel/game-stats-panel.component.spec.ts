import { TestBed, ComponentFixture } from '@angular/core/testing';
import { GameStatsPanelComponent } from './game-stats-panel.component';
import { BoardStateStore } from '../../services/board-state.store';
import { TranslationService } from '../../../../core/services/translation.service';
import { GameHistoryEntry } from '../../models/game-history.model';

function createMockEntry(entryId: string): GameHistoryEntry {
  return {
    entryId,
    playerColorId: '',
    description: '',
    scores: {},
    avgProd: {},
    placements: [],
    roads: [],
    devCardsPurchased: {},
    devCardsPlayed: [],
    timestamp: 0,
  };
}

describe('GameStatsPanelComponent', () => {
  let component: GameStatsPanelComponent;
  let fixture: ComponentFixture<GameStatsPanelComponent>;
  let store: BoardStateStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameStatsPanelComponent],
      providers: [BoardStateStore, TranslationService],
    }).compileComponents();

    fixture = TestBed.createComponent(GameStatsPanelComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(BoardStateStore);

    // Setup playerColors
    store.playerColors.set([
      { id: 'red', hex: '#ef4444' },
      { id: 'blue', hex: '#3b82f6' },
    ]);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should switch active tabs', () => {
    expect(component['activeTab']()).toBe('progress');
    component['activeTab'].set('projection');
    expect(component['activeTab']()).toBe('projection');
  });

  it('should return fallback baseline initial paths when history is empty', () => {
    store.gameHistory.set([]);
    expect(component['vpPaths']()).toHaveSize(2);
    expect(component['prodPaths']()).toHaveSize(2);
  });

  it('should compute paths correctly when history has data', () => {
    store.gameHistory.set([
      {
        entryId: 'start',
        playerColorId: '',
        description: 'Start',
        scores: { red: 2, blue: 2 },
        avgProd: { red: 0.1, blue: 0.15 },
        placements: [],
        roads: [],
        devCardsPurchased: {},
        devCardsPlayed: [],
        timestamp: Date.now(),
      },
      {
        entryId: 'move-1',
        playerColorId: 'red',
        description: '+1 settlement',
        scores: { red: 3, blue: 2 },
        avgProd: { red: 0.25, blue: 0.15 },
        placements: [],
        roads: [],
        devCardsPurchased: {},
        devCardsPlayed: [],
        timestamp: Date.now(),
      },
    ]);

    const vpPaths = component['vpPaths']();
    expect(vpPaths).toHaveSize(2);

    const redVp = vpPaths.find(p => p.color.id === 'red');
    expect(redVp).toBeTruthy();
    expect(redVp?.points).toHaveSize(2);
    // At index 0, VP score is 2 -> Y baseline (170)
    expect(redVp?.points[0].y).toBe(170);
    // At index 1, VP score is 3 -> Y is higher (smaller Y value)
    expect(redVp?.points[1].y).toBeLessThan(170);

    const prodPaths = component['prodPaths']();
    expect(prodPaths).toHaveSize(2);
    const blueProd = prodPaths.find(p => p.color.id === 'blue');
    expect(blueProd).toBeTruthy();
    expect(blueProd?.points).toHaveSize(2);
    // Blue expected yield is 0.15 -> Y should be the same since blue avgProd didn't change
    expect(blueProd?.points[0].y).toBe(blueProd?.points[1].y);
  });

  it('should calculate projection ranges and speed class based on expected production', () => {
    // 3 players game
    store.playerCount.set(3);

    spyOn(store, 'playerScores').and.returnValue([
      {
        color: { id: 'red', hex: '#ef4444' },
        score: 2,
        avgProd: 1.2,
        settlementsCount: 2,
        citiesCount: 0,
        roadsCount: 2,
        longestRoadLength: 2,
        hasLongestRoad: false,
        hasLargestArmy: false,
        vpCards: 0,
        knightsPlayed: 0,
        devCardsInHand: 0,
      },
      {
        color: { id: 'blue', hex: '#3b82f6' },
        score: 9,
        avgProd: 0.05,
        settlementsCount: 4,
        citiesCount: 2,
        roadsCount: 5,
        longestRoadLength: 5,
        hasLongestRoad: false,
        hasLargestArmy: false,
        vpCards: 1,
        knightsPlayed: 2,
        devCardsInHand: 1,
      },
    ]);

    const projections = component['projections']();
    expect(projections).toHaveSize(2);

    const redProj = projections.find(p => p.color.id === 'red');
    expect(redProj).toBeTruthy();
    expect(redProj?.speedClass).toBe('fast'); // 1.2 >= 1.2
    expect(redProj?.roundsRange).toMatch(/rounds|rondas/);

    const blueProj = projections.find(p => p.color.id === 'blue');
    expect(blueProj).toBeTruthy();
    expect(blueProj?.speedClass).toBe('slow'); // 0.15 < 0.7
  });

  describe('Usability and Zoom Improvements', () => {
    it('should initialize with default states', () => {
      expect(component['isZoomMode']()).toBeFalse();
      expect(component['highlightedPlayerId']()).toBeNull();
      expect(component['scrollLeft']()).toBe(0);
      expect(component['containerWidth']()).toBe(0);
    });

    it('should toggle isZoomMode', () => {
      component['toggleZoomMode']();
      expect(component['isZoomMode']()).toBeTrue();
      component['toggleZoomMode']();
      expect(component['isZoomMode']()).toBeFalse();
    });

    it('should toggle highlightedPlayerId', () => {
      component['toggleHighlightPlayer']('red');
      expect(component['highlightedPlayerId']()).toBe('red');

      component['toggleHighlightPlayer']('red');
      expect(component['highlightedPlayerId']()).toBeNull();

      component['toggleHighlightPlayer']('blue');
      expect(component['highlightedPlayerId']()).toBe('blue');
    });

    it('should calculate zoomedSvgWidth correctly', () => {
      // Empty history
      store.gameHistory.set([]);
      expect(component['zoomedSvgWidth']()).toBe(700);

      // 1 item
      store.gameHistory.set([createMockEntry('start')]);
      expect(component['zoomedSvgWidth']()).toBe(700);

      // 5 items -> 120 + 4 * 50 = 320
      store.gameHistory.set([
        createMockEntry('start'),
        createMockEntry('1'),
        createMockEntry('2'),
        createMockEntry('3'),
        createMockEntry('4'),
      ]);
      expect(component['zoomedSvgWidth']()).toBe(320);
    });

    it('should calculate zoomXEnd correctly depending on zoom mode', () => {
      store.gameHistory.set([
        createMockEntry('start'),
        createMockEntry('1'),
        createMockEntry('2'),
        createMockEntry('3'),
        createMockEntry('4'),
      ]);

      // Default: full mode
      expect(component['isZoomMode']()).toBeFalse();
      expect(component['zoomXEnd']()).toBe(640);

      // Zoom mode
      component['isZoomMode'].set(true);
      expect(component['zoomXEnd']()).toBe(320 - 60); // 260
    });
  });
});
