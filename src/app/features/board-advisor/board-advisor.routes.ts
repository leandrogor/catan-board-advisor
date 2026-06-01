import { Routes } from '@angular/router';

export const BOARD_ADVISOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./board-advisor-page.component').then(m => m.BoardAdvisorPageComponent),
  },
];
