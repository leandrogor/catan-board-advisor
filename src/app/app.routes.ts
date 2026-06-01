import { Routes } from '@angular/router';
import { ShellComponent } from './shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/board-advisor/board-advisor.routes').then(r => r.BOARD_ADVISOR_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
