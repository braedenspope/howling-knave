import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Quiet, themed confirmation toasts (parchment styling lives in the global
 * `.hk-toast` panel class). Use for the moments that matter — seals,
 * outcomes, duty covers — not for every interaction.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  show(message: string, durationMs = 3200): void {
    this.snack.open(message, '', {
      duration: durationMs,
      panelClass: 'hk-toast',
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }

  /**
   * A blocked-action warning — visually distinct (red accent) and held a little
   * longer so the player can read why something couldn't be done.
   */
  warn(message: string, durationMs = 4500): void {
    this.snack.open(message, '', {
      duration: durationMs,
      panelClass: ['hk-toast', 'hk-toast-warn'],
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
