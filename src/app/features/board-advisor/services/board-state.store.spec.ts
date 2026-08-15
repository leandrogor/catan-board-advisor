import { TestBed } from '@angular/core/testing';
import { BoardStateStore } from './board-state.store';
import { PlacedRoad } from '../models/road-option.model';
import { BoardSnapshot } from '../models/board-snapshot.model';
import { TranslationService } from '../../../core/services/translation.service';

describe('BoardStateStore - Longest Road', () => {
  let store: BoardStateStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BoardStateStore],
    });
    store = TestBed.inject(BoardStateStore);
    // Initialize standard player colors for the test
    store.playerColors.set([
      { id: 'red', hex: '#ef4444' },
      { id: 'blue', hex: '#3b82f6' },
      { id: 'mustard', hex: '#eab308' },
    ]);
  });

  describe('calculateLongestRoadForPlayer', () => {
    it('should return 0 when there are no roads placed', () => {
      store.placedRoads.set([]);
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(0);
      expect(result).toHaveSize(result.path.length);
    });

    it('should return 1 for a single road segment', () => {
      const road: PlacedRoad = { from: 'v1', to: 'v2', playerColorId: 'red' };
      store.placedRoads.set([road]);
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(1);
      expect(result).toHaveSize(result.path.length);
      expect(result.path[0]).toEqual(road);
    });

    it('should compute continuous straight path lengths correctly', () => {
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
      ]);
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(3);
      expect(result).toHaveSize(result.path.length);
    });

    it('should respect opponent settlements blocking the path', () => {
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
      ]);

      // Opponent blue occupies v3
      store.placedSettlements.set([{ vertexId: 'v3', playerColorId: 'blue', type: 'settlement' }]);

      // Path should be broken at v3, so longest road can only be 2 (v1 -> v2 -> v3)
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(2);
      expect(result).toHaveSize(result.path.length);
    });

    it('should allow own settlements to not block the path', () => {
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
      ]);

      // We occupy v3
      store.placedSettlements.set([{ vertexId: 'v3', playerColorId: 'red', type: 'settlement' }]);

      // Path remains unbroken, length = 3
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(3);
      expect(result).toHaveSize(result.path.length);
    });

    it('should calculate loop path lengths correctly', () => {
      // Triangle loop: v1-v2-v3-v1
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v1', playerColorId: 'red' },
      ]);

      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(3);
      expect(result).toHaveSize(result.path.length);
    });

    it('should calculate loop + tail path lengths correctly without reusing road segments', () => {
      // Triangle loop v1-v2-v3-v1 and tail v1-v4
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v1', playerColorId: 'red' },
        { from: 'v1', to: 'v4', playerColorId: 'red' },
      ]);

      // Path v4 -> v1 -> v2 -> v3 -> v1 is length 4 (no edge repeated)
      const result = store.calculateLongestRoadForPlayer('red');
      expect(result.path).toHaveSize(4);
      expect(result).toHaveSize(result.path.length);
    });
  });

  describe('recalculateLongestRoadOwner & tie rules', () => {
    it('should not award card if longest road is less than 5', () => {
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' }, // Length 4
      ]);
      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBeNull();
    });

    it('should award card to player reaching length 5 first', () => {
      store.placedRoads.set([
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' }, // Length 5
      ]);
      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBe('red');
    });

    it('should allow current owner to retain card when another player ties their length', () => {
      // Red has length 5 and holds card
      store.longestRoadOwnerId.set('red');
      store.placedRoads.set([
        // Red (5)
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' },
        // Blue (5)
        { from: 'u1', to: 'u2', playerColorId: 'blue' },
        { from: 'u2', to: 'u3', playerColorId: 'blue' },
        { from: 'u3', to: 'u4', playerColorId: 'blue' },
        { from: 'u4', to: 'u5', playerColorId: 'blue' },
        { from: 'u5', to: 'u6', playerColorId: 'blue' },
      ]);

      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBe('red');
    });

    it('should transfer card when another player strictly exceeds the owner length', () => {
      // Red has length 5 and holds card
      store.longestRoadOwnerId.set('red');
      store.placedRoads.set([
        // Red (5)
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' },
        // Blue (6)
        { from: 'u1', to: 'u2', playerColorId: 'blue' },
        { from: 'u2', to: 'u3', playerColorId: 'blue' },
        { from: 'u3', to: 'u4', playerColorId: 'blue' },
        { from: 'u4', to: 'u5', playerColorId: 'blue' },
        { from: 'u5', to: 'u6', playerColorId: 'blue' },
        { from: 'u6', to: 'u7', playerColorId: 'blue' },
      ]);

      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBe('blue');
    });

    it('should return card to bank when owner is broken and new leaders are tied', () => {
      // Red had length 8 (holds card)
      store.longestRoadOwnerId.set('red');

      // Placed roads: Red has 8, Blue has 6, Mustard has 6
      store.placedRoads.set([
        // Red (8 segments: v1 -> v9)
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' },
        { from: 'v6', to: 'v7', playerColorId: 'red' },
        { from: 'v7', to: 'v8', playerColorId: 'red' },
        { from: 'v8', to: 'v9', playerColorId: 'red' },
        // Blue (6 segments: u1 -> u7)
        { from: 'u1', to: 'u2', playerColorId: 'blue' },
        { from: 'u2', to: 'u3', playerColorId: 'blue' },
        { from: 'u3', to: 'u4', playerColorId: 'blue' },
        { from: 'u4', to: 'u5', playerColorId: 'blue' },
        { from: 'u5', to: 'u6', playerColorId: 'blue' },
        { from: 'u6', to: 'u7', playerColorId: 'blue' },
        // Mustard (6 segments: m1 -> m7)
        { from: 'm1', to: 'm2', playerColorId: 'mustard' },
        { from: 'm2', to: 'm3', playerColorId: 'mustard' },
        { from: 'm3', to: 'm4', playerColorId: 'mustard' },
        { from: 'm4', to: 'm5', playerColorId: 'mustard' },
        { from: 'm5', to: 'm6', playerColorId: 'mustard' },
        { from: 'm6', to: 'm7', playerColorId: 'mustard' },
      ]);

      // Opponent places settlement breaking Red's road exactly in half (at v5)
      // Red's road becomes two parts of length 4.
      store.placedSettlements.set([{ vertexId: 'v5', playerColorId: 'blue', type: 'settlement' }]);

      // Red is now at length 4. Blue and Mustard are tied at length 6.
      // Card must go to the bank (null owner).
      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBeNull();
    });

    it('should award card to another player if owner is broken and that player is the unique leader', () => {
      // Red had length 8 (holds card)
      store.longestRoadOwnerId.set('red');

      // Placed roads: Red has 8, Blue has 6
      store.placedRoads.set([
        // Red (8 segments: v1 -> v9)
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' },
        { from: 'v6', to: 'v7', playerColorId: 'red' },
        { from: 'v7', to: 'v8', playerColorId: 'red' },
        { from: 'v8', to: 'v9', playerColorId: 'red' },
        // Blue (6 segments: u1 -> u7)
        { from: 'u1', to: 'u2', playerColorId: 'blue' },
        { from: 'u2', to: 'u3', playerColorId: 'blue' },
        { from: 'u3', to: 'u4', playerColorId: 'blue' },
        { from: 'u4', to: 'u5', playerColorId: 'blue' },
        { from: 'u5', to: 'u6', playerColorId: 'blue' },
        { from: 'u6', to: 'u7', playerColorId: 'blue' },
      ]);

      // Break Red's road at v5. Red falls to length 4.
      // Blue is unique leader with length 6.
      store.placedSettlements.set([{ vertexId: 'v5', playerColorId: 'blue', type: 'settlement' }]);

      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBe('blue');
    });

    it('should let previous owner retain the card if their road is broken but they are still tied for the lead', () => {
      // Red has length 8 (holds card)
      store.longestRoadOwnerId.set('red');

      // Placed roads: Red has 8, Blue has 5
      store.placedRoads.set([
        // Red (8 segments: v1 -> v9)
        { from: 'v1', to: 'v2', playerColorId: 'red' },
        { from: 'v2', to: 'v3', playerColorId: 'red' },
        { from: 'v3', to: 'v4', playerColorId: 'red' },
        { from: 'v4', to: 'v5', playerColorId: 'red' },
        { from: 'v5', to: 'v6', playerColorId: 'red' },
        { from: 'v6', to: 'v7', playerColorId: 'red' },
        { from: 'v7', to: 'v8', playerColorId: 'red' },
        { from: 'v8', to: 'v9', playerColorId: 'red' },
        // Blue (5 segments)
        { from: 'u1', to: 'u2', playerColorId: 'blue' },
        { from: 'u2', to: 'u3', playerColorId: 'blue' },
        { from: 'u3', to: 'u4', playerColorId: 'blue' },
        { from: 'u4', to: 'u5', playerColorId: 'blue' },
        { from: 'u5', to: 'u6', playerColorId: 'blue' },
      ]);

      // Break Red's road at v4 (split into length 3 and 5)
      // Red is now tied with Blue at length 5.
      store.placedSettlements.set([{ vertexId: 'v4', playerColorId: 'blue', type: 'settlement' }]);

      store.recalculateLongestRoadOwner();
      expect(store.longestRoadOwnerId()).toBe('red');
    });
  });

  describe('Game History & Action Grouping', () => {
    it('should initialize game history on startGamePhase', () => {
      store.appPhase.set('setup');
      store.placedSettlements.set([
        { vertexId: 'v1', playerColorId: 'red', type: 'settlement' },
        { vertexId: 'v2', playerColorId: 'blue', type: 'settlement' },
      ]);
      store.startGamePhase();

      expect(store.appPhase()).toBe('game');
      const history = store.gameHistory();
      expect(history).toHaveSize(1);
      expect(history[0].entryId).toBe('start');
      expect(history[0].placements).toHaveSize(2);
    });

    it('should append entry on first action by player and update on consecutive actions', () => {
      store.appPhase.set('game');
      store.gameActivePlayerId.set('red');

      // Initialize start state
      store.gameHistory.set([
        {
          entryId: 'start',
          playerColorId: '',
          description: 'Start',
          scores: { red: 2, blue: 2, mustard: 2 },
          avgProd: { red: 0.1, blue: 0.1, mustard: 0.1 },
          placements: [],
          roads: [],
          devCardsPurchased: {},
          devCardsPlayed: [],
          timestamp: Date.now(),
        },
      ]);

      // 1. Red builds a road (first action) -> appends a new entry
      store.buildRoad('v1', 'v2');

      let history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(history[1].playerColorId).toBe('red');
      expect(history[1].description).toMatch(/1 camino|1 road/);

      // 2. Red builds a settlement (consecutive action) -> updates the last entry
      store.buildSettlement('v3');

      history = store.gameHistory();
      expect(history).toHaveSize(2); // Still 2 entries!
      expect(history[1].description).toMatch(/poblado|settlement/);

      // 3. Blue builds a road (different player) -> appends a new entry
      store.gameActivePlayerId.set('blue');
      store.buildRoad('u1', 'u2');

      history = store.gameHistory();
      expect(history).toHaveSize(3); // Appended!
      expect(history[2].playerColorId).toBe('blue');
      expect(history[2].description).toMatch(/1 camino|1 road/);
    });

    it('should format city upgrades and played development cards correctly in Spanish and English history logs', () => {
      const translationService = store['translationService'];

      // Test Spanish
      translationService.lang.set('es');
      store.appPhase.set('game');
      store.gameActivePlayerId.set('red');
      store.currentTurnIndex.set(store.totalTurns());

      store.gameHistory.set([
        {
          entryId: 'start',
          playerColorId: '',
          description: 'Start',
          scores: { red: 2 },
          avgProd: { red: 0.1 },
          placements: [{ vertexId: 'v1', playerColorId: 'red', type: 'settlement' }],
          roads: [],
          devCardsPurchased: { red: 2 },
          devCardsPlayed: [],
          timestamp: Date.now(),
        },
      ]);
      store.placedSettlements.set([{ vertexId: 'v1', playerColorId: 'red', type: 'settlement' }]);
      store.devCardsPurchased.set({ red: 2 });
      store.devCardsPlayed.set([]);

      store.upgradeToCity('v1');
      let history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(history[1].description).toBe('1 ciudad');

      store.playDevCard('red', 'knight');
      history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(history[1].description).toBe('1 ciudad, 1 carta jugada (Caballero)');

      // Test English
      translationService.lang.set('en');
      store.currentTurnIndex.set(store.totalTurns());
      store.gameHistory.set([
        {
          entryId: 'start',
          playerColorId: '',
          description: 'Start',
          scores: { red: 2 },
          avgProd: { red: 0.1 },
          placements: [{ vertexId: 'v1', playerColorId: 'red', type: 'settlement' }],
          roads: [],
          devCardsPurchased: { red: 2 },
          devCardsPlayed: [],
          timestamp: Date.now(),
        },
      ]);
      store.placedSettlements.set([{ vertexId: 'v1', playerColorId: 'red', type: 'settlement' }]);
      store.devCardsPurchased.set({ red: 2 });
      store.devCardsPlayed.set([]);

      store.upgradeToCity('v1');
      history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(history[1].description).toBe('1 city');

      store.playDevCard('red', 'knight');
      history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(history[1].description).toBe('1 city, 1 card played (Knight)');
    });

    it('should not allow upgrading settlement to city during initial setup phase', () => {
      store.appPhase.set('results');
      store.currentTurnIndex.set(0); // Setup phase incomplete
      store.placedSettlements.set([{ vertexId: 'v1', playerColorId: 'red', type: 'settlement' }]);

      store.upgradeToCity('v1');

      const settlement = store.placedSettlements().find(s => s.vertexId === 'v1');
      expect(settlement?.type).toBe('settlement');
    });
  });

  describe('Snapshot import/export resolution independence', () => {
    it('should correctly restore placed settlements when imported at a different hex size', () => {
      // 1. Setup board with a specific variant & desertState
      store.playerCount.set(3); // Base game
      store.desertState.set({
        variant: 'base',
        L1: { row: 2, col: 2 },
      });
      // Set a starting hex size R = 60 (e.g. desktop)
      store.hexSize.set(60);

      // Force grid/vertices to compute
      const initialVertices = store.allVertices();
      expect(initialVertices.length).toBeGreaterThan(0);

      // Place a settlement on the first vertex
      const firstVertex = initialVertices[0];
      store.placedSettlements.set([
        { vertexId: firstVertex.id, playerColorId: 'red', type: 'settlement' },
      ]);

      // 2. Export state to a mock snapshot JSON object
      const snapshot: BoardSnapshot = {
        version: 2,
        playerCount: store.playerCount(),
        playerColors: store.playerColors(),
        myPlayerColorId: store.myPlayerColorId(),
        desertState: store.desertState(),
        placedSettlements: store.placedSettlements(),
        placedRoads: store.placedRoads(),
        currentTurnIndex: store.currentTurnIndex(),
        boardRotationDeg: store.boardRotationDeg(),
        appPhase: store.appPhase(),
        gameActivePlayerId: store.gameActivePlayerId(),
        longestRoadOwnerId: store.longestRoadOwnerId(),
        largestArmyOwnerId: store.largestArmyOwnerId(),
        useReducedDeck: store.useReducedDeck(),
        devCardsPurchased: store.devCardsPurchased(),
        devCardsPlayed: store.devCardsPlayed(),
        gameHistory: store.gameHistory(),
        simulationResult: null,
      };

      // 3. Reset the board and change size to R = 30 (e.g. mobile)
      store.placedSettlements.set([]);
      store.hexSize.set(30);

      // 4. Import the snapshot
      const success = store.importSnapshot(snapshot);
      expect(success).toBe(true);

      // 5. Verify that the settlement is restored on the correct vertex
      const restoredSettlements = store.placedSettlements();
      expect(restoredSettlements).toHaveSize(1);
      expect(restoredSettlements[0].vertexId).toBe(firstVertex.id);

      // Verify that the restored settlement matches a vertex in the new grid
      const newVertices = store.allVertices();
      const matchingVertex = newVertices.find(v => v.id === restoredSettlements[0].vertexId);
      expect(matchingVertex).toBeDefined();
    });
  });

  describe('myExpansionSuggestions road occupancy validation', () => {
    it('should not suggest paths that are blocked by opponent roads', () => {
      // 1. Setup board
      store.playerCount.set(3);
      store.desertState.set({ variant: 'base', L1: { row: 2, col: 2 } });
      store.hexSize.set(60);
      store.appPhase.set('game');
      store.myPlayerColorId.set('green');

      // Find 3 connected vertices v1 -> v2 -> v3
      const vertices = store.allVertices();
      const v1 = vertices.find(v => v.adjacentVertexIds.length >= 2);
      expect(v1).toBeDefined();
      const v2Id = v1!.adjacentVertexIds[0];
      const v2 = vertices.find(v => v.id === v2Id);
      expect(v2).toBeDefined();
      const v3Id = v2!.adjacentVertexIds.find(id => id !== v1!.id)!;
      expect(v3Id).toBeDefined();

      // Ensure vertices are not blocked/occupied initially
      store.placedSettlements.set([]);
      store.placedRoads.set([]);

      // Place green settlement at v1
      store.placedSettlements.set([
        { vertexId: v1!.id, playerColorId: 'green', type: 'settlement' },
      ]);
      // Place green road v1 -> v2
      store.placedRoads.set([{ from: v1!.id, to: v2Id, playerColorId: 'green' }]);

      // At this point, v2 is adjacent to our road network. v3 is also adjacent to v2.
      // So the advisor should suggest a 1-road extension from v2 to v3 (or another adjacent vertex).
      let suggestions = store.myExpansionSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);

      // Verify suggestion target and path
      const sug = suggestions.find(s => s.targetVertexId === v3Id);
      if (sug) {
        const hasV2ToV3 = sug.newRoads.some(
          r => (r.from === v2Id && r.to === v3Id) || (r.from === v3Id && r.to === v2Id),
        );
        expect(hasV2ToV3).toBe(true);
      }

      // Now, place a blue road on the edge v2 -> v3
      store.placedRoads.set([
        { from: v1!.id, to: v2Id, playerColorId: 'green' },
        { from: v2Id, to: v3Id, playerColorId: 'blue' },
      ]);

      // The advisor should recalculate and no longer suggest v3 via v2 -> v3
      suggestions = store.myExpansionSuggestions();
      const blockedSug = suggestions.find(s => s.targetVertexId === v3Id);
      if (blockedSug) {
        // If there's still a suggestion for v3, it must not be via the blocked edge v2 -> v3
        const hasBlockedRoad = blockedSug.newRoads.some(
          r => (r.from === v2Id && r.to === v3Id) || (r.from === v3Id && r.to === v2Id),
        );
        expect(hasBlockedRoad).toBe(false);
      }
    });

    it('should not suggest building roads starting from a vertex occupied by an opponent settlement', () => {
      store.playerCount.set(3);
      store.desertState.set({ variant: 'base', L1: { row: 2, col: 2 } });
      store.hexSize.set(60);
      store.appPhase.set('game');
      store.myPlayerColorId.set('green');

      const vertices = store.allVertices();
      const v1 = vertices.find(v => v.adjacentVertexIds.length >= 2);
      expect(v1).toBeDefined();
      const v2Id = v1!.adjacentVertexIds[0];

      // Green settlement at v1, green road v1 -> v2
      // Blue settlement placed at v2
      store.placedSettlements.set([
        { vertexId: v1!.id, playerColorId: 'green', type: 'settlement' },
        { vertexId: v2Id, playerColorId: 'blue', type: 'settlement' },
      ]);
      store.placedRoads.set([{ from: v1!.id, to: v2Id, playerColorId: 'green' }]);

      const suggestions = store.myExpansionSuggestions();
      // No suggestion should have a new road starting from v2Id
      for (const sug of suggestions) {
        const startsFromV2 = sug.newRoads.some(r => r.from === v2Id);
        expect(startsFromV2).toBe(false);
      }
    });

    it('should suggest settlement/road expansion on existing road ends beyond an opponent settlement', () => {
      store.playerCount.set(3);
      store.desertState.set({ variant: 'base', L1: { row: 2, col: 2 } });
      store.hexSize.set(60);
      store.appPhase.set('game');
      store.myPlayerColorId.set('green');

      const vertices = store.allVertices();
      const v1 = vertices.find(v => v.adjacentVertexIds.length >= 2);
      expect(v1).toBeDefined();
      const v2Id = v1!.adjacentVertexIds[0];
      const v2 = vertices.find(v => v.id === v2Id)!;
      const v3Id = v2.adjacentVertexIds.find(id => id !== v1!.id)!;
      const v3 = vertices.find(v => v.id === v3Id)!;
      const v4Id = v3.adjacentVertexIds.find(id => id !== v2Id)!;

      // Green settlement at v1, green roads v1 -> v2 and v2 -> v3
      // Blue settlement placed at v2 (v3 is 1 edge from v2, so distance rule blocks settlement at v3)
      // v4 is 2 edges from v2, so v4 is valid for settlement
      store.placedSettlements.set([
        { vertexId: v1!.id, playerColorId: 'green', type: 'settlement' },
        { vertexId: v2Id, playerColorId: 'blue', type: 'settlement' },
      ]);
      store.placedRoads.set([
        { from: v1!.id, to: v2Id, playerColorId: 'green' },
        { from: v2Id, to: v3Id, playerColorId: 'green' },
      ]);

      const suggestions = store.myExpansionSuggestions();
      // Green already built road up to v3Id beyond Blue's settlement.
      // Advisor should suggest extending 1 road from v3Id to v4Id.
      const sugForV4 = suggestions.find(s => s.targetVertexId === v4Id);
      expect(sugForV4).toBeDefined();
      if (sugForV4) {
        expect(sugForV4.newRoads).toHaveSize(1);
        expect(sugForV4.newRoads[0]).toEqual({ from: v3Id, to: v4Id });
      }
    });

    it('should suggest a 3-road extension if all 1-road and 2-road paths are blocked', () => {
      // 1. Setup board
      store.playerCount.set(3);
      store.desertState.set({ variant: 'base', L1: { row: 2, col: 2 } });
      store.hexSize.set(60);
      store.appPhase.set('game');
      store.myPlayerColorId.set('green');

      // Find 4 connected vertices v1 -> v2 -> v3 -> v4 and a blocking neighbor of v3
      const vertices = store.allVertices();
      let path: string[] | null = null;
      for (const start of vertices) {
        for (const next1 of start.adjacentVertexIds) {
          const v2 = vertices.find(v => v.id === next1);
          if (!v2) continue;
          for (const next2 of v2.adjacentVertexIds) {
            if (next2 === start.id) continue;
            const v3 = vertices.find(v => v.id === next2);
            if (!v3) continue;
            for (const next3 of v3.adjacentVertexIds) {
              if (next3 === next1 || next3 === start.id) continue;
              // We need v3 to have at least one other neighbor to block it
              const vBlockId = v3.adjacentVertexIds.find(id => id !== next1 && id !== next3);
              if (vBlockId) {
                path = [start.id, next1, next2, next3, vBlockId];
                break;
              }
            }
            if (path) break;
          }
          if (path) break;
        }
        if (path) break;
      }
      expect(path).toBeDefined();
      const [v1Id, v2Id, v3Id, v4Id, vBlockId] = path!;

      // Reset placements and roads
      const placedSet = new Set<string>([v1Id, vBlockId]);
      const placedSettlements = [
        { vertexId: v1Id, playerColorId: 'green', type: 'settlement' as const },
        { vertexId: vBlockId, playerColorId: 'blue', type: 'settlement' as const },
      ];

      const v1 = vertices.find(v => v.id === v1Id)!;
      for (const tId of v1.adjacentVertexIds) {
        const vT = vertices.find(v => v.id === tId);
        if (!vT) continue;
        for (const uId of vT.adjacentVertexIds) {
          if (uId === v1Id || uId === v3Id) continue;

          const vU = vertices.find(v => v.id === uId)!;
          if (vU.adjacentVertexIds.includes(v4Id)) {
            // Block uId by placing a blue settlement at its neighbor (not v4Id, not tId, not v1Id)
            const uBlockId = vU.adjacentVertexIds.find(
              id => id !== v4Id && id !== tId && id !== v1Id,
            )!;
            if (!placedSet.has(uBlockId)) {
              placedSet.add(uBlockId);
              placedSettlements.push({
                vertexId: uBlockId,
                playerColorId: 'blue',
                type: 'settlement' as const,
              });
            }
          } else {
            // Occupy uId directly
            if (!placedSet.has(uId)) {
              placedSet.add(uId);
              placedSettlements.push({
                vertexId: uId,
                playerColorId: 'blue',
                type: 'settlement' as const,
              });
            }
          }
        }
      }

      store.placedSettlements.set(placedSettlements);
      store.placedRoads.set([]);

      // Check suggestions. Since v2 is adjacent to v1 (blocked), and v3 is adjacent to vBlockId (blocked),
      // there are no 1-road or 2-road suggestions targeting unblocked spots from v1.
      // But v4 is unblocked, so it should suggest a 3-road extension from v1 to v4: v1 -> v2 -> v3 -> v4.
      const suggestions = store.myExpansionSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);

      const sug = suggestions.find(s => s.targetVertexId === v4Id);
      expect(sug).toBeDefined();
      if (sug) {
        expect(sug.newRoads).toHaveSize(3);
        const hasV1ToV2 = sug.newRoads.some(
          r => (r.from === v1Id && r.to === v2Id) || (r.from === v2Id && r.to === v1Id),
        );
        const hasV2ToV3 = sug.newRoads.some(
          r => (r.from === v2Id && r.to === v3Id) || (r.from === v3Id && r.to === v2Id),
        );
        const hasV3ToV4 = sug.newRoads.some(
          r => (r.from === v3Id && r.to === v4Id) || (r.from === v4Id && r.to === v3Id),
        );
        expect(hasV1ToV2).toBe(true);
        expect(hasV2ToV3).toBe(true);
        expect(hasV3ToV4).toBe(true);
      }
    });
  });

  describe('Projection Target Settings', () => {
    it('should default to "me" if designated, or "none" if myPlayerColorId is unassigned', () => {
      store.myPlayerColorId.set('red');
      expect(store.projectionTargetPlayerId()).toBe('me');
      expect(store.effectiveProjectionPlayerId()).toBe('red');

      store.setProjectionTargetPlayerId('blue');
      expect(store.effectiveProjectionPlayerId()).toBe('blue');

      store.setProjectionTargetPlayerId('none');
      expect(store.effectiveProjectionPlayerId()).toBeNull();

      // When myPlayerColorId is unassigned, resetToSetup defaults to 'none'
      store.myPlayerColorId.set(null);
      store.resetToSetup();
      expect(store.projectionTargetPlayerId()).toBe('none');
      expect(store.effectiveProjectionPlayerId()).toBeNull();
    });

    it('should set projectionTargetPlayerId to "me" if myPlayerColorId is in snapshot, or "none" if unassigned', () => {
      const snapshotWithMe: BoardSnapshot = {
        version: 2,
        playerCount: 3,
        myPlayerColorId: 'green',
      };
      store.importSnapshot(snapshotWithMe);
      expect(store.myPlayerColorId()).toBe('green');
      expect(store.projectionTargetPlayerId()).toBe('me');

      const snapshotWithoutMe: BoardSnapshot = {
        version: 2,
        playerCount: 4,
        myPlayerColorId: null,
      };
      store.importSnapshot(snapshotWithoutMe);
      expect(store.myPlayerColorId()).toBeNull();
      expect(store.projectionTargetPlayerId()).toBe('none');
    });

    it('should calculate primary expansion suggestion for targeted player', () => {
      store.playerCount.set(3);
      store.desertState.set({ variant: 'base', L1: { row: 2, col: 2 } });
      store.hexSize.set(60);
      store.appPhase.set('game');
      store.myPlayerColorId.set('green');
      store.setProjectionTargetPlayerId('me');

      const vertices = store.allVertices();
      const v1 = vertices.find(v => v.adjacentVertexIds.length >= 2);
      expect(v1).toBeDefined();

      store.placedSettlements.set([
        { vertexId: v1!.id, playerColorId: 'green', type: 'settlement' },
      ]);

      const suggestions = store.myExpansionSuggestions();
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].playerColorId).toBe('green');
    });
  });

  describe('Custom Player Names', () => {
    it('should set and retrieve custom player names, falling back to color name if unconfigured', () => {
      expect(store.getPlayerName('red')).toBeDefined();
      store.setPlayerName('red', 'Juan');
      expect(store.getPlayerName('red')).toBe('Juan');
    });

    it('should persist playerNames in snapshot export and import', () => {
      store.setPlayerName('red', 'Juan');
      store.setPlayerName('blue', 'Maria');

      const snapshot: BoardSnapshot = {
        version: 2,
        playerCount: 3,
        playerColors: store.playerColors(),
        myPlayerColorId: store.myPlayerColorId(),
        playerNames: store.playerNames(),
        desertState: store.desertState(),
        placedSettlements: [],
        placedRoads: [],
        currentTurnIndex: 0,
        boardRotationDeg: 0,
        appPhase: 'setup',
        gameActivePlayerId: null,
        longestRoadOwnerId: null,
        largestArmyOwnerId: null,
        useReducedDeck: false,
        devCardsPurchased: {},
        devCardsPlayed: [],
        gameHistory: [],
        simulationResult: null,
      };

      store.playerNames.set({});
      expect(store.getPlayerName('red')).not.toBe('Juan');

      const success = store.importSnapshot(snapshot);
      expect(success).toBe(true);
      expect(store.getPlayerName('red')).toBe('Juan');
      expect(store.getPlayerName('blue')).toBe('Maria');
    });

    it('should format history descriptions dynamically based on current language', () => {
      const translationService = TestBed.inject(TranslationService);
      translationService.lang.set('es');
      store.startGamePhase();
      const firstVertex = store.scoredVertices()[0];
      store.buildSettlement(firstVertex.id);

      const history = store.gameHistory();
      expect(history).toHaveSize(2);

      // In Spanish:
      const descEs = store.formatHistoryDescription(history[1], history[0]);
      expect(descEs).toContain('poblado');

      // Switch language to English dynamically:
      translationService.lang.set('en');
      const descEn = store.formatHistoryDescription(history[1], history[0]);
      expect(descEn).toContain('settlement');
    });

    it('should restore undoStack and redoStack when importing version 2 snapshot', () => {
      store.startGamePhase();
      const firstVertex = store.scoredVertices()[0];
      store.buildSettlement(firstVertex.id);

      expect(store.undoStack().length).toBeGreaterThan(0);

      // Perform undo to populate redoStack
      store.undo();
      expect(store.redoStack()).toHaveSize(1);

      const mockSnapshot: BoardSnapshot = {
        version: 2,
        playerCount: store.playerCount(),
        playerColors: store.playerColors(),
        myPlayerColorId: store.myPlayerColorId(),
        playerNames: store.playerNames(),
        desertState: store.desertState(),
        placedSettlements: store.placedSettlements(),
        placedRoads: store.placedRoads(),
        undoStack: store.undoStack(),
        redoStack: store.redoStack(),
        desertUndoStack: store.desertUndoStack(),
        desertRedoStack: store.desertRedoStack(),
        currentTurnIndex: store.currentTurnIndex(),
        boardRotationDeg: store.boardRotationDeg(),
        appPhase: store.appPhase(),
        gameActivePlayerId: store.gameActivePlayerId(),
        longestRoadOwnerId: store.longestRoadOwnerId(),
        largestArmyOwnerId: store.largestArmyOwnerId(),
        useReducedDeck: store.useReducedDeck(),
        devCardsPurchased: store.devCardsPurchased(),
        devCardsPlayed: store.devCardsPlayed(),
        gameHistory: store.gameHistory(),
        simulationResult: null,
      };

      // Reset store
      store.resetToSetup();
      expect(store.undoStack()).toHaveSize(0);
      expect(store.redoStack()).toHaveSize(0);

      // Import snapshot
      const imported = store.importSnapshot(mockSnapshot);
      expect(imported).toBe(true);
      expect(store.redoStack()).toHaveSize(1);

      // Reapply redo after snapshot load
      store.redo();
      expect(store.placedSettlements()).toHaveSize(1);
    });

    it('should cancel active road selection and transient state when undo or redo is called', () => {
      store.startGamePhase();
      const firstVertex = store.scoredVertices()[0];
      store.buildSettlement(firstVertex.id);

      // Start selecting a road
      store.startSelectingRoad(firstVertex.id);
      expect(store.isSelectingRoad()).toBe(true);
      expect(store.pendingSettlementVertexId()).toBe(firstVertex.id);

      // Call undo
      store.undo();
      expect(store.isSelectingRoad()).toBe(false);
      expect(store.pendingSettlementVertexId()).toBeNull();
      expect(store.activeBuildTool()).toBeNull();
    });

    it('should keep gameHistory in sync when undoing grouped actions within the same turn', () => {
      const translationService = TestBed.inject(TranslationService);
      translationService.lang.set('es');
      store.startGamePhase();

      const vertices = store.scoredVertices();
      const v1 = vertices[0];
      const v2 = vertices.find(x => v1.adjacentVertexIds.includes(x.id))!;

      // Player Red builds settlement
      store.buildSettlement(v1.id);
      let history = store.gameHistory();
      expect(history).toHaveSize(2);
      expect(store.formatHistoryDescription(history[1], history[0])).toContain('poblado');

      // Player Red builds road (grouped in same turn entry)
      store.buildRoad(v1.id, v2.id);
      history = store.gameHistory();
      expect(history).toHaveSize(2); // grouped!
      expect(store.formatHistoryDescription(history[1], history[0])).toContain('camino');

      // Undo road build: history length remains 2, but description should revert to settlement only
      store.undo();
      history = store.gameHistory();
      expect(history).toHaveSize(2);
      const descAfterUndo = store.formatHistoryDescription(history[1], history[0]);
      expect(descAfterUndo).toContain('poblado');
      expect(descAfterUndo).not.toContain('camino');
      expect(store.placedRoads()).toHaveSize(0);

      // Undo settlement build: history length reverts to 1
      store.undo();
      history = store.gameHistory();
      expect(history).toHaveSize(1);
      expect(store.placedSettlements()).toHaveSize(0);
    });
  });

  describe('Dev Cards Probabilities and Estimated Potential', () => {
    it('should compute card probabilities when all cards are purchased into players hands (0 in pile)', () => {
      // 1 Knight played
      store.devCardsPlayed.set([{ playerColorId: 'red', type: 'knight' }]);
      // 33 cards in hand (all remaining cards bought)
      store.devCardsPurchased.set({ red: 32, blue: 1 });

      const remainingTotal = store.remainingTotal();
      expect(remainingTotal).toBe(33);

      const totalInHand = Object.values(store.devCardsPurchased()).reduce((s, n) => s + n, 0);
      expect(totalInHand).toBe(33);

      // Draw pile has 0 cards left
      expect(remainingTotal - totalInHand).toBe(0);

      // Probabilities should NOT be 0 for all card types
      const probs = store.drawProbabilities();
      expect(probs.knight).toBeCloseTo(19 / 33, 4);
      expect(probs.victoryPoint).toBeCloseTo(5 / 33, 4);
      expect(probs.monopoly).toBeCloseTo(3 / 33, 4);
      expect(probs.roadBuilding).toBeCloseTo(3 / 33, 4);
      expect(probs.yearOfPlenty).toBeCloseTo(3 / 33, 4);
    });

    it('should return 0 probabilities when all cards in the game are played', () => {
      // 34 cards played (20 knights, 5 VP, 3 monopoly, 3 road building, 3 year of plenty)
      store.devCardsPlayed.set([
        ...Array(20).fill({ playerColorId: 'red', type: 'knight' }),
        ...Array(5).fill({ playerColorId: 'red', type: 'victoryPoint' }),
        ...Array(3).fill({ playerColorId: 'blue', type: 'monopoly' }),
        ...Array(3).fill({ playerColorId: 'blue', type: 'roadBuilding' }),
        ...Array(3).fill({ playerColorId: 'mustard', type: 'yearOfPlenty' }),
      ]);
      store.devCardsPurchased.set({});

      expect(store.remainingTotal()).toBe(0);

      const probs = store.drawProbabilities();
      expect(probs.knight).toBe(0);
      expect(probs.victoryPoint).toBe(0);
      expect(probs.monopoly).toBe(0);
      expect(probs.roadBuilding).toBe(0);
      expect(probs.yearOfPlenty).toBe(0);
    });
  });

  describe('Non-producing vertex ranking', () => {
    it('should assign the last production rank to non-producing vertices instead of null', () => {
      const ranked = store.rankedVertices();
      const nonNullRanks = ranked.map(v => v.rank).filter((r): r is number => r !== null);
      expect(nonNullRanks).toHaveSize(ranked.length); // Every vertex must have a non-null rank

      const producingVertices = ranked.filter(
        v => (v.rawScore ?? 0) > 0 && !v.isBlocked && !v.isOccupied,
      );
      const nonProducingVertices = ranked.filter(v => (v.rawScore ?? 0) === 0);

      if (producingVertices.length > 0 && nonProducingVertices.length > 0) {
        const lastRank = nonProducingVertices[0].rank;
        expect(lastRank).toBeGreaterThan(0);
        // Non-producing vertices should have a rank greater than top producing vertices
        const topRank = store.topVertex()?.rank;
        expect(topRank).toBe(1);
        expect(lastRank).toBeGreaterThan(1);
      }
    });
  });

  describe('Player Order Swapping during Initial Placement Phase', () => {
    beforeEach(() => {
      store.playerCount.set(3);
      store.playerColors.set([
        { id: 'red', hex: '#ef4444' },
        { id: 'blue', hex: '#3b82f6' },
        { id: 'mustard', hex: '#eab308' },
      ]);
    });

    it('should allow swapping any valid slot in setup phase', () => {
      store.appPhase.set('setup');
      expect(store.canSwapPlayerOrder(0)).toBeTrue();
      expect(store.canSwapPlayerOrder(1)).toBeTrue();
      expect(store.canSwapPlayerOrder(2)).toBeTrue();
      expect(store.canSwapPlayerOrder(3)).toBeFalse();

      store.swapPlayerOrder(0, 2);
      expect(store.playerColors().map(c => c.id)).toEqual(['mustard', 'blue', 'red']);
    });

    it('should allow swapping remaining unplaced players during Round 1 of initial placement', () => {
      store.appPhase.set('results');
      store.currentTurnIndex.set(0); // Turn 0: Red's turn for 1st settlement

      expect(store.isRound1Placement()).toBeTrue();
      expect(store.canSwapPlayerOrder(0)).toBeTrue();
      expect(store.canSwapPlayerOrder(1)).toBeTrue();
      expect(store.canSwapPlayerOrder(2)).toBeTrue();

      // Swap Red (0) and Blue (1) before Red places settlement
      store.swapPlayerOrder(0, 1);
      expect(store.playerColors().map(c => c.id)).toEqual(['blue', 'red', 'mustard']);
      expect(store.currentPlayerColor()?.id).toBe('blue');

      // Now turn index becomes 1 (Blue placed 1st settlement)
      store.currentTurnIndex.set(1);

      // Slot 0 (Blue) is locked. Slots 1 (Red) and 2 (Mustard) can be swapped
      expect(store.canSwapPlayerOrder(0)).toBeFalse();
      expect(store.canSwapPlayerOrder(1)).toBeTrue();
      expect(store.canSwapPlayerOrder(2)).toBeTrue();

      // Try swapping locked slot 0 - should be ignored
      store.swapPlayerOrder(0, 2);
      expect(store.playerColors().map(c => c.id)).toEqual(['blue', 'red', 'mustard']);

      // Swap Red (1) and Mustard (2)
      store.swapPlayerOrder(1, 2);
      expect(store.playerColors().map(c => c.id)).toEqual(['blue', 'mustard', 'red']);
      expect(store.currentPlayerColor()?.id).toBe('mustard');
    });

    it('should lock all player swapping during Round 2 of initial placement', () => {
      store.appPhase.set('results');
      store.currentTurnIndex.set(3); // Turn 3: 2nd settlements start (Round 2)

      expect(store.isRound1Placement()).toBeFalse();
      expect(store.canSwapPlayerOrder(0)).toBeFalse();
      expect(store.canSwapPlayerOrder(1)).toBeFalse();
      expect(store.canSwapPlayerOrder(2)).toBeFalse();

      store.swapPlayerOrder(0, 1);
      expect(store.playerColors().map(c => c.id)).toEqual(['red', 'blue', 'mustard']);
    });

    it('should restore player order when undoing and redoing actions', () => {
      store.appPhase.set('results');
      store.currentTurnIndex.set(0);

      // Swap Red and Blue
      store.swapPlayerOrder(0, 1);
      expect(store.playerColors()[0].id).toBe('blue');

      // Simulate placing settlement 1 for Blue and advancing turn to 1
      store.pendingSettlementVertexId.set('v1');
      store.confirmRoadSelection('v2');
      expect(store.currentTurnIndex()).toBe(1);

      // Undo placement
      store.undo();
      expect(store.currentTurnIndex()).toBe(0);
      expect(store.playerColors()[0].id).toBe('blue');

      // Redo placement
      store.redo();
      expect(store.currentTurnIndex()).toBe(1);
      expect(store.playerColors()[0].id).toBe('blue');
    });
  });

  describe('ActionDetail return on undo and redo', () => {
    it('should return action details specifying player and description on undo and redo', () => {
      store.appPhase.set('game');
      store.playerColors.set([
        { id: 'red', hex: '#ef4444' },
        { id: 'blue', hex: '#3b82f6' },
      ]);
      store.setPlayerName('red', 'Lean');

      // 1. Build road
      store.buildRoad('v1', 'v2', 'red');

      // 2. Undo road build
      const undoDetail = store.undo();
      expect(undoDetail).not.toBeNull();
      expect(undoDetail?.playerColorId).toBe('red');
      expect(undoDetail?.playerName).toBe('Lean');
      expect(undoDetail?.description).toContain('Lean');

      // 3. Redo road build
      const redoDetail = store.redo();
      expect(redoDetail).not.toBeNull();
      expect(redoDetail?.playerColorId).toBe('red');
      expect(redoDetail?.playerName).toBe('Lean');
      expect(redoDetail?.description).toContain('Lean');
    });
  });

  describe('Evaluation Mode & Theoretical Ranking', () => {
    it('should default evaluationMode to theoretical or stored preference', () => {
      expect(['theoretical', 'simulation']).toContain(store.evaluationMode());
    });

    it('should update evaluationMode and re-evaluate when in results phase', () => {
      store.appPhase.set('results');
      store.setEvaluationMode('theoretical');
      expect(store.evaluationMode()).toBe('theoretical');
      expect(store.simulationResult()).not.toBeNull();

      store.setEvaluationMode('simulation');
      expect(store.evaluationMode()).toBe('simulation');
      expect(store.simulationResult()).not.toBeNull();
    });

    it('should give identical rank to vertices with identical theoretical score', () => {
      store.setEvaluationMode('theoretical');
      store.appPhase.set('results');

      const ranked = store.rankedVertices();
      expect(ranked.length).toBeGreaterThan(0);

      // Find any vertices with identical rawScore (> 0)
      const eligible = ranked.filter(v => (v.rawScore ?? 0) > 0 && !v.isBlocked && !v.isOccupied);
      const scoreMap = new Map<number, typeof eligible>();
      for (const v of eligible) {
        const rounded = Math.round((v.rawScore ?? 0) * 1000000) / 1000000;
        const list = scoreMap.get(rounded) ?? [];
        list.push(v);
        scoreMap.set(rounded, list);
      }

      // Check that all vertices in any tied group have the exact same rank
      for (const [, tiedGroup] of scoreMap) {
        if (tiedGroup.length > 1) {
          const firstRank = tiedGroup[0].rank;
          for (const v of tiedGroup) {
            expect(v.rank).toBe(firstRank);
          }
        }
      }
    });
  });
});
