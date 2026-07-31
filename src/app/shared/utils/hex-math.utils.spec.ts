import { deduplicateVertices } from './hex-math.utils';
import { HexDefinition } from '../../features/board-advisor/models/hex.model';

describe('hex-math.utils', () => {
  describe('deduplicateVertices', () => {
    it('should deduplicate vertices that are within 1.0 unit of tolerance', () => {
      const R = 50;
      // We will mock two hex definitions with centers and vertices that are very close.
      // A pointy-topped hex at (0, 0) and another hex at (0, 0) but with slight floating point noise.
      const hexes: HexDefinition[] = [
        {
          id: 'hex-1',
          row: 0,
          col: 0,
          letter: 'A',
          diceNumber: 5,
          isDesert: false,
          center: { x: 0, y: 0 },
        },
        {
          id: 'hex-2',
          row: 0,
          col: 1,
          letter: 'B',
          diceNumber: 6,
          isDesert: false,
          // Let's offset the center by a tiny amount so that its vertices will be extremely close
          // to hex-1's vertices, simulating precision discrepancies.
          center: { x: 0.01, y: 0.01 },
        },
      ];

      const vertices = deduplicateVertices(hexes, R);

      // A single hex has 6 vertices. Since hex-1 and hex-2 are virtually identical,
      // all their vertices should merge. So we expect exactly 6 deduplicated vertices.
      expect(vertices).toHaveSize(6);

      // Each deduplicated vertex should be associated with both hex-1 and hex-2
      for (const v of vertices) {
        expect(v.adjacentHexIds).toContain('hex-1');
        expect(v.adjacentHexIds).toContain('hex-2');
      }
    });

    it('should not deduplicate vertices that are far apart', () => {
      const R = 50;
      const hexes: HexDefinition[] = [
        {
          id: 'hex-1',
          row: 0,
          col: 0,
          letter: 'A',
          diceNumber: 5,
          isDesert: false,
          center: { x: 0, y: 0 },
        },
        {
          id: 'hex-2',
          row: 2,
          col: 2,
          letter: 'B',
          diceNumber: 6,
          isDesert: false,
          center: { x: 300, y: 300 }, // Far away
        },
      ];

      const vertices = deduplicateVertices(hexes, R);

      // The two hexes are far apart, so none of their vertices should merge.
      // We expect 6 + 6 = 12 vertices.
      expect(vertices).toHaveSize(12);
    });
  });
});
