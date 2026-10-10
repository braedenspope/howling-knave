import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CalendarEvent, CalendarEventVisibility } from '../../../shared/models';
import { ChronometerService } from '../chronometer.service';
import { ToastService } from '../../../shared/toast.service';
import { ArgousDatePickerComponent } from '../argous-date-picker.component';
import { ArgousDate, formatDate, fromAbsDay, toAbsDay } from '../engine';

export interface EventEditorData {
  /** Editing an existing event; omit to create one. */
  event?: CalendarEvent;
  /** The day a new event starts on. */
  absDay: number;
}

/** Create, edit, or delete a dated event (DM only). */
@Component({
  selector: 'app-event-editor-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, ArgousDatePickerComponent],
  templateUrl: './event-editor-dialog.component.html',
  styles: [`
    .ee-modal { position: relative; padding: 8px 6px 6px; display: flex; flex-direction: column; gap: 14px; }
    .ee-title { margin: 0; font-size: 24px; letter-spacing: 0.5px; }
    .ee-vis { display: flex; gap: 8px; }
    .ee-vis .btn { flex: 1; justify-content: center; }
    .ee-vis .btn.on { border-color: var(--accent-gold); color: var(--accent-gold); background: rgba(196,154,60,0.1); }
    .ee-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    .ee-actions .btn-danger { margin-right: auto; }
  `],
})
export class EventEditorDialogComponent {
  private chrono = inject(ChronometerService);
  private toast = inject(ToastService);
  private ref = inject(MatDialogRef<EventEditorDialogComponent>);
  protected data = inject<EventEditorData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.event;
  protected title = this.data.event?.title ?? '';
  protected body = this.data.event?.body ?? '';
  protected readonly date = signal<ArgousDate>(
    fromAbsDay(this.data.event?.abs_day ?? this.data.absDay),
  );
  protected readonly visibility = signal<CalendarEventVisibility>(
    this.data.event?.visibility ?? 'dm',
  );
  protected readonly saving = signal(false);

  async save() {
    const title = this.title.trim();
    if (!title) return;
    this.saving.set(true);
    try {
      const draft = {
        abs_day: toAbsDay(this.date()),
        title,
        body: this.body.trim() || null,
        visibility: this.visibility(),
      };
      if (this.data.event) await this.chrono.updateEvent(this.data.event.id, draft);
      else await this.chrono.createEvent(draft);
      this.toast.show(`${this.isEdit ? 'Updated' : 'Added'} — ${title}, ${formatDate(this.date())}`);
      this.ref.close(true);
    } catch (e) {
      this.toast.warn((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  async remove() {
    const event = this.data.event;
    if (!event || !confirm(`Delete “${event.title}”?`)) return;
    this.saving.set(true);
    try {
      await this.chrono.deleteEvent(event.id);
      this.toast.show(`Deleted — ${event.title}`);
      this.ref.close(true);
    } catch (e) {
      this.toast.warn((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}

export function openEventEditor(dialog: MatDialog, data: EventEditorData) {
  return dialog.open(EventEditorDialogComponent, {
    width: '560px',
    maxWidth: '95vw',
    panelClass: 'hk-dialog',
    data,
  });
}
