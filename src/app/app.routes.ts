import { Routes } from '@angular/router';
import { authGuard, dmGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'board', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./core/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./core/auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'board',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/voyage/voyage-board/voyage-board.component').then(m => m.VoyageBoardComponent),
  },
  {
    path: 'voyages',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/voyage/voyage-list/voyage-list.component').then(m => m.VoyageListComponent),
  },
  {
    path: 'crew',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/crew/crew.component').then(m => m.CrewComponent),
  },
  {
    path: 'progress',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/progress/player-progress/player-progress.component').then(m => m.PlayerProgressComponent),
  },
  {
    path: 'dm',
    canActivate: [authGuard, dmGuard],
    loadComponent: () =>
      import('./features/dm/dm-dashboard/dm-dashboard.component').then(m => m.DmDashboardComponent),
  },
  { path: '**', redirectTo: 'board' },
];
