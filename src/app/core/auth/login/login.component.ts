import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <mat-card-title class="gold-text">The Last Weaving</mat-card-title>
          <mat-card-subtitle>Sign in to continue</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          @if (error()) {
            <p class="error-text">{{ error() }}</p>
          }
          <form (ngSubmit)="onLogin()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email</mat-label>
              <input matInput type="email" [(ngModel)]="email" name="email" required />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="password" name="password" required />
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width"
              [disabled]="submitting()"
            >
              @if (submitting()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                Sign In
              }
            </button>
          </form>
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button routerLink="/register">Create Account</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }

    .auth-card {
      width: 100%;
      max-width: 400px;
      border-radius: 2px !important;
      position: relative;
      overflow: visible;

      // Rope border at top
      &::before {
        content: '';
        position: absolute;
        top: -4px;
        left: 10%;
        right: 10%;
        height: 4px;
        background: repeating-linear-gradient(
          90deg,
          var(--accent-copper) 0px,
          var(--accent-copper) 8px,
          transparent 8px,
          transparent 12px
        );
        border-radius: 2px;
      }
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      margin-bottom: 8px;
    }

    .error-text {
      color: var(--failure-red);
      margin-bottom: 12px;
      font-size: 14px;
      font-family: var(--font-body);
    }

    mat-card-title {
      font-family: var(--font-heading) !important;
      font-size: 24px !important;
      margin-bottom: 4px;
      letter-spacing: 1px;
    }

    mat-card-subtitle {
      font-family: var(--font-body) !important;
    }

    // Wax seal decoration
    :host mat-card-header::after {
      content: '';
      position: absolute;
      top: 12px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 40%, #b83a1a, #8b2500 60%, #6a1a00);
      box-shadow: 0 2px 6px rgba(0,0,0,0.5), inset 0 -1px 3px rgba(0,0,0,0.3);
    }
  `],
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  submitting = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async onLogin() {
    this.submitting.set(true);
    this.error.set(null);
    const err = await this.auth.login(this.email, this.password);
    this.submitting.set(false);
    if (err) {
      this.error.set(err);
    } else {
      this.router.navigate(['/board']);
    }
  }
}
