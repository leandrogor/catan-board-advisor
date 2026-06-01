import { Component, input, output } from '@angular/core';
import { Vertex } from '../../models/vertex.model';
import { interpolateHeatmapColor } from '../../../../shared/utils/hex-math.utils';

@Component({
  selector: 'app-vertex-indicator',
  standalone: true,
  template: `<!-- Vertex indicator is rendered inline in board SVG for performance -->`,
})
export class VertexIndicatorComponent {
  vertex = input.required<Vertex>();
  selected = input<boolean>(false);
  vertexClick = output<string>();

  get radius(): number {
    return 4 + 8 * this.vertex().normalizedScore;
  }

  get fill(): string {
    const v = this.vertex();
    if (v.isOccupied) return 'var(--color-occupied)';
    if (v.isBlocked) return 'var(--color-blocked)';
    return interpolateHeatmapColor(v.normalizedScore);
  }
}
