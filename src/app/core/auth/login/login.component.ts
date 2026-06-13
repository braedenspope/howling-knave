import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
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
