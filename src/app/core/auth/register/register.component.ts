import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  displayName = '';
  characterName = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  submitting = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async onRegister() {
    this.error.set(null);
    this.success.set(null);

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }

    this.submitting.set(true);
    const err = await this.auth.register(
      this.email,
      this.password,
      this.displayName,
      this.characterName,
    );
    this.submitting.set(false);

    if (err) {
      this.error.set(err);
    } else {
      this.success.set('Account created! Check your email for confirmation, or sign in.');
    }
  }
}
