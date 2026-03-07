import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { VoyageService } from '../voyage.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-voyage-list',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    DatePipe,
  ],
  templateUrl: './voyage-list.component.html',
  styleUrl: './voyage-list.component.scss',
})
export class VoyageListComponent implements OnInit {
  newName = '';
  newDayCount = 7;
  creating = signal(false);
  error = signal<string | null>(null);

  constructor(
    public voyageService: VoyageService,
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.voyageService.loadVoyages();
  }

  async onCreate() {
    this.creating.set(true);
    this.error.set(null);
    const err = await this.voyageService.createVoyage(this.newName, this.newDayCount);
    this.creating.set(false);
    if (err) {
      this.error.set(err);
    } else {
      this.newName = '';
      this.newDayCount = 7;
    }
  }

  async setActive(voyageId: string) {
    await this.voyageService.setActiveVoyage(voyageId);
  }

  async onDelete(voyageId: string, name: string) {
    if (!confirm(`Delete voyage "${name}"? This will remove all days and training blocks.`)) return;
    const err = await this.voyageService.deleteVoyage(voyageId);
    if (err) this.error.set(err);
  }

  openBoard() {
    this.router.navigate(['/board']);
  }
}
