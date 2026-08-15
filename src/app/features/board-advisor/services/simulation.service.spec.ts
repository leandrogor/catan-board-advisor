import { TestBed } from '@angular/core/testing';
import { SimulationService } from './simulation.service';
import { HexDefinition } from '../models/hex.model';
import { Vertex } from '../models/vertex.model';

describe('SimulationService', () => {
  let service: SimulationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SimulationService],
    });
    service = TestBed.inject(SimulationService);
  });

  function createMockHex(id: string, diceNumber: number | null, isDesert = false): HexDefinition {
    return {
      id,
      row: 0,
      col: 0,
      letter: 'A',
      diceNumber,
      isDesert,
      center: { x: 0, y: 0 },
    };
  }

  function createMockVertex(id: string, adjacentHexIds: string[]): Vertex {
    return {
      id,
      position: { x: 0, y: 0 },
      adjacentHexIds,
      adjacentVertexIds: [],
      totalResources: 0,
      rawScore: 0,
      normalizedScore: 0,
      rank: null,
      isOccupied: false,
      isBlocked: false,
    };
  }

  describe('runTheoretical', () => {
    it('should compute exact theoretical probability for symmetrical vertices (4-5-6 vs 8-9-10)', () => {
      const hexes: HexDefinition[] = [
        createMockHex('h4', 4),
        createMockHex('h5', 5),
        createMockHex('h6', 6),
        createMockHex('h8', 8),
        createMockHex('h9', 9),
        createMockHex('h10', 10),
      ];

      const v1 = createMockVertex('v-456', ['h4', 'h5', 'h6']);
      const v2 = createMockVertex('v-8910', ['h8', 'h9', 'h10']);

      const result = service.runTheoretical(hexes, [v1, v2], 100);

      // 4 (3 pips) + 5 (4 pips) + 6 (5 pips) = 12/36 = 1/3
      // 8 (5 pips) + 9 (4 pips) + 10 (3 pips) = 12/36 = 1/3
      const expectedScore = 12 / 36;
      expect(v1.rawScore).toBeCloseTo(expectedScore, 6);
      expect(v2.rawScore).toBeCloseTo(expectedScore, 6);
      expect(v1.rawScore).toEqual(v2.rawScore);

      expect(v1.totalResources).toBeCloseTo(expectedScore * 100, 6);
      expect(v2.totalResources).toBeCloseTo(expectedScore * 100, 6);

      expect(result.resourceMap.get('v-456')).toBeCloseTo(expectedScore, 6);
      expect(result.resourceMap.get('v-8910')).toBeCloseTo(expectedScore, 6);
      expect(result.maxRawScore).toBeCloseTo(expectedScore, 6);
      expect(v1.normalizedScore).toBeCloseTo(1.0, 6);
      expect(v2.normalizedScore).toBeCloseTo(1.0, 6);
    });

    it('should ignore desert hexes and null diceNumbers', () => {
      const hexes: HexDefinition[] = [
        createMockHex('h-desert', null, true),
        createMockHex('h6', 6),
      ];

      const v = createMockVertex('v1', ['h-desert', 'h6']);
      service.runTheoretical(hexes, [v], 100);

      // Only 6 (5 pips) = 5/36
      expect(v.rawScore).toBeCloseTo(5 / 36, 6);
    });

    it('should assign sequential dense ranks when multiple vertices tie for rank 1', () => {
      const hexes: HexDefinition[] = [
        createMockHex('h4', 4),
        createMockHex('h5', 5),
        createMockHex('h6', 6),
        createMockHex('h8', 8),
        createMockHex('h9', 9),
        createMockHex('h10', 10),
        createMockHex('h2', 2),
      ];

      const v1 = createMockVertex('v-456', ['h4', 'h5', 'h6']); // 12 pips -> Rank 1
      const v2 = createMockVertex('v-8910', ['h8', 'h9', 'h10']); // 12 pips -> Rank 1
      const v3 = createMockVertex('v-2', ['h2']); // 1 pip -> Rank 2 (dense, not Rank 3)

      service.runTheoretical(hexes, [v1, v2, v3], 100);

      expect(v1.rank).toBe(1);
      expect(v2.rank).toBe(1);
      expect(v3.rank).toBe(2);
    });

    it('should correctly populate theoretical rollCountMap across all games', () => {
      const hexes: HexDefinition[] = [createMockHex('h6', 6)];
      const v = createMockVertex('v1', ['h6']);
      const result = service.runTheoretical(hexes, [v], 100);

      // In 100 rolls, dice 6 (5/36) expected = (5/36) * 100 = ~13.888
      // Across 10,000 games = (5/36) * 100 * 10000
      const rollsInGame = (result.rollCountMap.get(6) ?? 0) / result.totalMiniGames;
      expect(rollsInGame).toBeCloseTo((5 / 36) * 100, 6);

      // Dice 7 is excluded
      expect(result.rollCountMap.has(7)).toBeFalse();
    });
  });

  describe('run (mode dispatch)', () => {
    it('should use runTheoretical by default or when mode is theoretical', () => {
      const hexes: HexDefinition[] = [createMockHex('h8', 8)];
      const v = createMockVertex('v1', ['h8']);

      const resDefault = service.run(hexes, [{ ...v }], 100);
      const resTheoretical = service.run(hexes, [{ ...v }], 100, 'theoretical');

      expect(resDefault.resourceMap.get('v1')).toBeCloseTo(5 / 36, 6);
      expect(resTheoretical.resourceMap.get('v1')).toBeCloseTo(5 / 36, 6);
    });

    it('should use runSimulation when mode is simulation', () => {
      const hexes: HexDefinition[] = [createMockHex('h8', 8)];
      const v = createMockVertex('v1', ['h8']);

      const resSimulation = service.run(hexes, [{ ...v }], 100, 'simulation');
      // Monte Carlo should be near 5/36 (~0.1388) within statistical tolerance
      const score = resSimulation.resourceMap.get('v1') ?? 0;
      expect(score).toBeGreaterThan(0.12);
      expect(score).toBeLessThan(0.16);
    });
  });
});
