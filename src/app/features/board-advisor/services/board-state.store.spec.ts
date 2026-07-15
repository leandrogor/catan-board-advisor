import { TestBed } from '@angular/core/testing';
import { BoardStateStore } from './board-state.store';
import { PlacedRoad } from '../models/road-option.model';

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
      const snapshot = {
        version: 1,
        playerCount: store.playerCount(),
        playerColors: store.playerColors(),
        myPlayerColorId: store.myPlayerColorId(),
        boardVariant: store.boardVariant(),
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
});
