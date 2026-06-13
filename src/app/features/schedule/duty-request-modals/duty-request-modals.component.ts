import { Component, OnInit, computed } from '@angular/core';
import { DutyRequestService } from '../duty-request.service';
import { ScheduleService } from '../schedule.service';
import { AuthService } from '../../../core/auth/auth.service';
import { DutyRequest, SLOT_WEIGHT_UNITS } from '../../../shared/models';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

type ModalState =
  | { kind: 'compose' }
  | { kind: 'incoming'; req: DutyRequest }
  | { kind: 'waiting'; req: DutyRequest }
  | { kind: 'result'; req: DutyRequest };

@Component({
  selector: 'app-duty-request-modals',
  standalone: true,
  imports: [],
  template: `
    @if (active(); as m) {
      <div class="hk-modal-overlay">
        <div class="hk-card corners hk-modal fade-up">
          @switch (m.kind) {

            @case ('compose') {
              <p class="stamp-label">Ship duty · hour {{ composeHour() }}</p>
              <h3>Ask a crewmate to take your watch</h3>
              <p class="hk-modal-sub">{{ composeTask() }} — it keeps its hour, so only crew with hour {{ composeHour() }} free can take it.</p>
              <div class="request-target-list">
                @for (row of targetRows(); track row.user.id) {
                  @if (row.eligible) {
                    <button class="training-option" (click)="requests.send(row.user.id)">
                      <span class="to-topic">{{ row.user.character_name }}</span>
                      <span class="to-desc">{{ row.user.display_name }}</span>
                    </button>
                  } @else {
                    <button class="training-option blocked" disabled>
                      <span class="to-topic">{{ row.user.character_name }}</span>
                      <span class="to-note blocked-note"><span class="ms sm">block</span> Hour {{ composeHour() }} already filled</span>
                    </button>
                  }
                } @empty {
                  <p class="hk-modal-sub">No other crew aboard to ask.</p>
                }
              </div>
              <div class="hk-modal-actions">
                <button class="btn btn-ghost" (click)="requests.cancelCompose()">Cancel</button>
              </div>
            }

            @case ('incoming') {
              <p class="stamp-label">A request from the crew</p>
              <h3>{{ name(m.req.from_user) }} asks you to stand their watch</h3>
              <p class="hk-modal-sub">{{ task(m.req) }}</p>
              <div class="hk-modal-actions">
                <button class="btn btn-danger" (click)="requests.deny(m.req)">Decline</button>
                <button class="btn btn-brass" (click)="requests.accept(m.req)">
                  <span class="ms sm">anchor</span> Take the watch
                </button>
              </div>
            }

            @case ('waiting') {
              <p class="stamp-label">Awaiting word</p>
              <h3>Waiting for {{ name(m.req.to_user) }}…</h3>
              <div class="hk-modal-spinner"><span class="compass-spin">＊</span></div>
              <p class="hk-modal-sub">Your request to hand off {{ task(m.req) }} is with them.</p>
              <div class="hk-modal-actions">
                <button class="btn btn-ghost" (click)="requests.cancel(m.req)">Cancel request</button>
              </div>
            }

            @case ('result') {
              @if (m.req.status === 'accepted') {
                <p class="stamp-label gold-text">Accepted</p>
                <h3>{{ name(m.req.to_user) }} took the watch</h3>
                <p class="hk-modal-sub">The duty now sits on their schedule. A debt remembered.</p>
              } @else {
                <p class="stamp-label">Declined</p>
                <h3>{{ name(m.req.to_user) }} can't take it</h3>
                <p class="hk-modal-sub">The watch stays yours — find another hand, or stand it yourself.</p>
              }
              <div class="hk-modal-actions">
                <button class="btn btn-brass" (click)="requests.acknowledge(m.req)">Understood</button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [':host { display: contents; }'],
})
export class DutyRequestModalsComponent implements OnInit {
  constructor(
    public requests: DutyRequestService,
    private schedule: ScheduleService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    if (this.schedule.allUsers().length === 0) this.schedule.loadAllUsers();
  }

  readonly active = computed<ModalState | null>(() => {
    const incoming = this.requests.incoming();
    if (incoming.length) return { kind: 'incoming', req: incoming[0] };
    const resolved = this.requests.outgoingResolved();
    if (resolved.length) return { kind: 'result', req: resolved[0] };
    if (this.requests.composeBlock()) return { kind: 'compose' };
    const waiting = this.requests.outgoingPending();
    if (waiting.length) return { kind: 'waiting', req: waiting[0] };
    return null;
  });

  /** Candidate crewmates with whether the duty's hour is free in their row. */
  readonly targetRows = computed(() => {
    const block = this.requests.composeBlock();
    const me = this.auth.userId();
    if (!block) return [];
    const dayBlocks = this.schedule.blocks().filter(b => b.day_id === block.day_id);
    return this.schedule
      .allUsers()
      .filter(u => u.id !== me)
      .map(u => ({
        user: u,
        eligible: !dayBlocks.some(
          b =>
            b.user_id === u.id &&
            block.slot_position >= b.slot_position &&
            block.slot_position < b.slot_position + SLOT_WEIGHT_UNITS[b.slot_weight],
        ),
      }));
  });

  composeTask(): string {
    return this.requests.composeBlock()?.training_topic ?? 'a ship duty';
  }

  composeHour(): string {
    const slot = this.requests.composeBlock()?.slot_position ?? 0;
    return ROMAN[slot] ?? `${slot + 1}`;
  }

  name(userId: string): string {
    return this.schedule.allUsers().find(u => u.id === userId)?.character_name ?? 'A crewmate';
  }

  task(req: DutyRequest): string {
    return this.schedule.blocks().find(b => b.id === req.block_id)?.training_topic ?? 'a ship duty';
  }
}
