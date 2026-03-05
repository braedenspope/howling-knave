import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait for initial auth check to finish
  while (auth.loading()) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!auth.isAuthed()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const dmGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  while (auth.loading()) {
    await new Promise(r => setTimeout(r, 50));
  }

  if (!auth.isDm()) {
    router.navigate(['/board']);
    return false;
  }
  return true;
};
