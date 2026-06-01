import { Component } from '@angular/core';
import { BoardComponent } from './components/board/board.component';
import { DesertConfigComponent } from './components/desert-config/desert-config.component';
import { BoardControlsComponent } from './components/board-controls/board-controls.component';
import { VertexDetailPanelComponent } from './components/vertex-detail-panel/vertex-detail-panel.component';

@Component({
  selector: 'app-board-advisor-page',
  standalone: true,
  imports: [
    BoardComponent,
    DesertConfigComponent,
    BoardControlsComponent,
    VertexDetailPanelComponent,
  ],
  template: `
    <app-desert-config />
    <div class="flex-1 flex items-center justify-center p-4">
      <app-board />
    </div>
    <app-board-controls />
    <app-vertex-detail-panel />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: calc(100dvh - 60px);
      }
    `,
  ],
})
export class BoardAdvisorPageComponent {}
