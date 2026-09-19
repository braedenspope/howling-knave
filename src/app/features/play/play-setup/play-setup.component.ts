import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlayService } from '../play.service';
import { VoyageService } from '../../voyage/voyage.service';
import { ScheduleService } from '../../schedule/schedule.service';
import { ConfirmationService } from '../../schedule/confirmation.service';
import { ToastService } from '../../../shared/toast.service';

/** A day still waiting on seals, and who it is waiting on. */
interface UnsealedDay {
  dayNumber: number;
  waitingOn: string[];
}

/**
 * The gate into play mode: every day must be sealed by every player, then the
 * DM sets the turn order the crew will run their hours in.
 */
@Component({
  selector: 'app-play-setup',
  standalone: true,
  imports: [],
  templateUrl: './play-setup.component.html',
  styleUrl: './play-setup.component.scss',
})
export class PlaySetupComponent implements OnInit {
  play = inject(PlayService);
  voyageService = inject(VoyageService);
  scheduleService = inject(ScheduleService);
  private confirmations = inject(ConfirmationService);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** Player ids in the order being edited, before it is committed. */
  readonly order = signal<string[]>([]);
  readonly saving = signal(false);

  async ngOnInit() {
    await this.play.bootstrap();

    const voyage = this.voyageService.activeVoyage();
    if (voyage) {
      const dayIds = this.voyageService.days().map(d => d.id);
      await this.confirmations.load(dayIds);
      this.confirmations.subscribe(voyage.id);
    }

    const stored = this.play.state()?.turn_order ?? [];
    this.order.set(this.reconcile(stored));
  }

  /** Keep a stored order but drop departed players and append new ones. */
  private reconcile(stored: string[]): string[] {
    const ids = this.scheduleService.allUsers().map(u => u.id);
    const kept = stored.filter(id => ids.includes(id));
    return [...kept, ...ids.filter(id => !kept.includes(id))];
  }

  characterName(userId: string): string {
    const user = this.scheduleService.allUsers().find(u => u.id === userId);
    return user?.character_name || user?.display_name || 'Unknown';
  }

  // ---- seal gate ----------------------------------------------------------

  readonly unsealed = computed<UnsealedDay[]>(() => {
    const players = this.scheduleService.allUsers();
    if (players.length === 0) return [];

    return this.voyageService.days()
      .map(day => {
        const sealed = this.confirmations.sealedFor(day.id);
        return {
          dayNumber: day.day_number,
          waitingOn: players.filter(p => !sealed.includes(p.id)).map(p => p.character_name || p.display_name),
        };
      })
      .filter(d => d.waitingOn.length > 0);
  });

  readonly allSealed = computed(() =>
    this.voyageService.days().length > 0 &&
    this.scheduleService.allUsers().length > 0 &&
    this.unsealed().length === 0,
  );

  // ---- order editing ------------------------------------------------------

  moveUp(index: number) {
    if (index <= 0) return;
    this.order.update(o => {
      const next = [...o];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveDown(index: number) {
    this.order.update(o => {
      if (index >= o.length - 1) return o;
      const next = [...o];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  // ---- run control --------------------------------------------------------

  async begin() {
    const voyage = this.voyageService.activeVoyage();
    if (!voyage || !this.allSealed() || this.order().length === 0) return;

    this.saving.set(true);
    const err = await this.play.start(voyage.id, this.order());
    this.saving.set(false);

    if (err) {
      this.toast.show(err);
      return;
    }
    this.toast.show(`The montage begins — ${this.play.queue().length} hours to run`);
    this.router.navigate(['/play']);
  }

  async saveOrder() {
    this.saving.set(true);
    const err = await this.play.setTurnOrder(this.order());
    this.saving.set(false);
    this.toast.show(err ?? 'Turn order updated');
  }

  resume() {
    this.router.navigate(['/play']);
  }

  async end() {
    const err = await this.play.stop();
    this.toast.show(err ?? 'The montage is called to a close');
  }
}
