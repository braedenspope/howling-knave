import { Component, OnInit, computed } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TrainingTrackerService } from '../../dm/training-tracker.service';
import { AuthService } from '../../../core/auth/auth.service';
import { CREW_COLORS } from '../../../shared/data/training.data';
import { TrainingProgress } from '../../../shared/models';

@Component({
  selector: 'app-player-progress',
  standalone: true,
  imports: [MatExpansionModule, MatCardModule, MatIconModule],
  templateUrl: './player-progress.component.html',
  styleUrl: './player-progress.component.scss',
})
export class PlayerProgressComponent implements OnInit {
  constructor(
    private tracker: TrainingTrackerService,
    private auth: AuthService,
  ) {}

  async ngOnInit() {
    const userId = this.auth.userId();
    if (userId) {
      await this.tracker.loadProgressForUser(userId);
    }
  }

  private myProgress() {
    const userId = this.auth.userId();
    return userId ? this.tracker.getProgressForUser(userId) : [];
  }

  masteredCount = computed(() => this.myProgress().filter(p => p.completed).length);
  inProgressCount = computed(() => this.myProgress().filter(p => !p.completed && p.successes_accumulated > 0).length);
  totalCount = computed(() => this.myProgress().length);

  groupedProgress = computed(() => {
    const progress = this.myProgress();
    const groups: Record<string, TrainingProgress[]> = {};
    for (const p of progress) {
      if (!groups[p.crew_member]) groups[p.crew_member] = [];
      groups[p.crew_member].push(p);
    }
    return Object.entries(groups)
      .map(([crewMember, trainings]) => ({ crewMember, trainings }))
      .sort((a, b) => a.crewMember.localeCompare(b.crewMember));
  });

  getCrewColor(name: string): string {
    return CREW_COLORS[name] ?? '#666';
  }

  getPips(training: TrainingProgress) {
    return Array.from({ length: training.successes_required }, (_, i) => ({
      filled: i < training.successes_accumulated,
    }));
  }
}
