# Voyage System — Implementation Spec

Spec for the prototype-only features not yet built into the Angular/Supabase app.
Each section gives: **schema** (SQL + RLS), **models**, **service**, **UI**, and **edge cases**.
Ordered by dependency and value. Items 5–6 need no backend.

## Current schema (reference)

| Table | Key columns |
|---|---|
| `users` | id, display_name, character_name, role (`player`\|`dm`), created_at |
| `voyages` | id, name, day_count, is_active, created_by, created_at |
| `days` | id, voyage_id, day_number, mandatory_duty (jsonb) |
| `schedule_blocks` | id, day_id, user_id, crew_member, training_topic, slot_weight, slot_position, status, is_mandatory, created_at, updated_at |
| `relationship_tiers` | id, user_id, crew_member, tier, notes, updated_at |
| `training_progress` | id, user_id, crew_member, training_topic, successes_accumulated, successes_required, last_trained_at, completed |
| `trainings` | id, crew_member_id, topic, description, reward, scene_seed, slot_weight, sessions_required, tier_required |
| `crew_members` | id, name, role |

> Ship duties already exist as `schedule_blocks` rows with `is_mandatory = true` (inserted by the duty-injector), owned by a `user_id`. The features below build on that.

---

## 1. Wax-seal confirmations (schedule lock) — **build first**

Each player "seals" their day. When every player has sealed, the day locks and editing is frozen.

### Schema — `scripts/migrations/002_day_confirmations.sql`
```sql
create table public.day_confirmations (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  sealed_at timestamptz not null default now(),
  unique (day_id, user_id)
);
alter table public.days add column if not exists locked boolean not null default false;

alter table public.day_confirmations enable row level security;
-- anyone authenticated may read confirmations
create policy dc_read on public.day_confirmations for select to authenticated using (true);
-- a player seals/withdraws only their own row
create policy dc_write on public.day_confirmations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```
`days.locked` is set by the client (or a trigger) when `count(confirmations) = count(players)`.
Trigger option (preferred, avoids races):
```sql
create or replace function public.recompute_day_lock(p_day uuid) returns void as $$
  update public.days d set locked = (
    (select count(*) from public.day_confirmations c where c.day_id = p_day)
    >= (select count(*) from public.users where role = 'player')
  ) where d.id = p_day;
$$ language sql;
-- call from AFTER INSERT/DELETE trigger on day_confirmations
```

### Models (`shared/models/index.ts`)
```ts
export interface DayConfirmation { id: string; day_id: string; user_id: string; sealed_at: string; }
// Day gains: locked: boolean;
```

### Service — `features/schedule/confirmation.service.ts`
- `confirmations = signal<DayConfirmation[]>([])`
- `loadConfirmations(dayIds)`, `subscribe(voyageId)` (realtime, like ScheduleService)
- `seal(dayId)` → insert `{day_id, user_id: auth.userId()}`
- `withdraw(dayId)` → delete own row for that day
- `sealedFor(dayId): Set<userId>`, `isSealed(dayId, userId)`, `allSealed(dayId)`

### UI
- **Day header** (`day-row`): a row of seal slots — one per player (`.day-seals` + `.seal-slot`). Filled slots render the `WaxSeal` (per-player hue, `seal-press` animation already in `styles.scss`).
- **Per player row**: a `.seal-action.confirm` ("Press your seal") that flips to `.seal-action.withdraw` once sealed. DM can seal on a player's behalf.
- **When `allSealed`**: render the `.locked-stamp` ("Schedule Locked", already styled), fire a toast (`"All hands sealed — Day N is locked"` / `"Sealed. Waiting on 2 crew"`).
- **Lock enforcement**: when `days.locked`, `day-row` hides add/remove/drag and the add-dialog refuses. This is the gate the next three features depend on.

### Edge cases
- Player count changes mid-voyage → recompute lock on player add/remove.
- Adding a block after seal should auto-withdraw the seal (block edit invalidates the lock).

---

## 2. Duty covering — depends on #1's "unlocked" concept

A player takes another player's ship-duty slot; the original owner's slot is cleared/marked covered. Visible to all.

### Schema — `scripts/migrations/003_duty_cover.sql`
```sql
alter table public.schedule_blocks
  add column if not exists covered_by uuid references public.users(id);
-- RLS: allow a player to set covered_by = themselves on any mandatory block in an
-- active voyage, and to clear it if they are the coverer.
create policy sb_cover on public.schedule_blocks for update to authenticated
  using (is_mandatory)
  with check (covered_by is null or covered_by = auth.uid());
```

### Service (`ScheduleService`)
- `coverDuty(blockId)` → `update {covered_by: auth.userId()}`
- `uncoverDuty(blockId)` → `update {covered_by: null}` (only if currently you)

### UI
- A duty cell owned by **another** player (schedule unlocked) shows a hover `.cover-btn` ("Cover"). Covered cells get `.duty-cell.covering` (dashed) + "covered by {firstName}".
- Toast on cover: `"You covered {owner}'s watch"`.

### Edge cases
- Covering doesn't move the block between rows — it stays in the owner's row, flagged. (Matches the chat's final decision.)
- Feeds the DM ledger in #3 (count of covers given/received per player).

---

## 3. Guner's correction detail — depends on #1, #2

DM locks one player's **training** for a full day (duties + independent only). Surfaces a covering ledger.

### Schema — `scripts/migrations/004_corrections.sql`
```sql
create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.days(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (day_id, user_id)
);
alter table public.corrections enable row level security;
create policy corr_read on public.corrections for select to authenticated using (true);
create policy corr_write on public.corrections for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'dm'));
```

### Service — `features/dm/correction.service.ts`
- `corrections = signal<Correction[]>([])`, `loadAll()`, `subscribe()`
- `setCorrection(dayId, userId, reason)`, `clear(dayId, userId)`
- `isCorrected(dayId, userId): boolean`

### UI
- **Board**: a corrected player's row shows the `.correction-chip` ("Correction detail — training locked"). The add-dialog blocks all **training** options (independent + cover still allowed) via a `.correction-note` banner.
- **DM dashboard → "Duties & Guner's Ledger" tab**: per-player card with covers-given / covers-received counts (from `covered_by`); a player who has leaned on others too long is flagged `.ledger-card.suspicious`. A **"Guner intervenes"** button opens a day picker → `setCorrection`. Toast: `"Guner has words for {name}. Day N training is locked."`

### Edge cases
- Recovery is automatic: the correction only applies to its `day_id`; the next day is normal.
- Don't auto-delete training blocks already placed — block new ones and visually lock existing.

---

## 4. Spotlight — flag + DM rotation ledger (independent of #1–#3)

Players flag a training session "I want this at the table"; the DM sees flags and a fairness rotation.

### Schema — `scripts/migrations/005_spotlight.sql`
```sql
alter table public.schedule_blocks add column if not exists spotlight boolean not null default false;
-- history powers the "voyages since last spotlight" rotation
create table public.spotlight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  voyage_id uuid not null references public.voyages(id) on delete cascade,
  block_id uuid references public.schedule_blocks(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.spotlight_log enable row level security;
create policy sl_read on public.spotlight_log for select to authenticated using (true);
create policy sl_write on public.spotlight_log for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role='dm'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role='dm'));
```
RLS for the `spotlight` flag: extend `schedule_blocks` update policy so the **owner** may toggle `spotlight` on their own non-mandatory block while the day is unlocked.

### Service
- `ScheduleService.toggleSpotlight(blockId)` (owner, unlocked, training blocks only).
- `features/dm/spotlight.service.ts`: `voyagesSinceSpotlight(userId)` computed from `spotlight_log` vs ordered `voyages`; `chooseSpotlight(block)` → insert `spotlight_log` row for this voyage. Overdue = > 2 voyages with active training.

### UI
- **`training-block`**: a `SpotlightFlag` pennant — gold (`.flagged`) when on, faint otherwise; only the owner toggles, only while unlocked.
- **DM dashboard → "Spotlight" tab**: `.rotation-grid` of player cards (`.rotation-card.overdue` when overdue), a list of flagged sessions (`.flagged-tag`), each with a **"Play it at the table"** button → `chooseSpotlight` + toast.

---

## 5. Mobile ship's-log timeline — **front-end only, no backend**

Below 860px the 8-column grid is too cramped; render the day as a vertical hour log. The `.tl-*` classes already exist in the design's `screens.css` (port the ones you need into `day-row.component.scss` / `screens.scss`).

### Approach
- Add a viewport signal: inject `BreakpointObserver` (`@angular/cdk/layout`) → `isMobile = toSignal(observe('(max-width: 860px)'))`, or a small matchMedia signal.
- In `day-row`, branch the template: desktop = current `.slots-grid`; mobile = `.tl-rows`.
  - **Your row**: hours top-to-bottom (`.tl-item` per hour), full-width entries for duty (`.tl-duty`), training (crew color, topic, spotlight flag, remove), and "Open hour — tap to plan" (`.tl-empty.interactive`). Seal button under the header.
  - **Crewmates**: collapse to a strip — first name + an 8-segment `.mini-bar` (copper = duty, crew color = training). Tap (`.tl-player-head.collapsible`) to expand into their hour list (cover buttons become tappable `.cover-btn-tl`).
- Optional Tweaks toggle "Mobile board: timeline / grid" (see #6).

### Notes
- No new data — same `schedule_blocks`. This is template + SCSS work concentrated in `day-row`.
- Largest risk is keeping the desktop grid untouched; gate purely on `isMobile()`.

---

## 6. Tweaks panel — **front-end only, no backend**

A floating panel that flips CSS custom properties live. `--texture-alpha` is already wired through every texture in `styles.scss`/`screens.scss`, so it works today.

### Service — `shared/tweaks.service.ts`
Signals persisted to `localStorage`, applied via `document.documentElement.style.setProperty(...)` / a body class:
- **Texture intensity** → `--texture-alpha` (0–1).
- **Metalwork accent** → swap `--accent-gold/-brass/-copper` to brass / copper / weathered-silver palettes.
- **Compass watermark** → toggle a body class that shows/hides a fixed compass-rose SVG.
- **Board density** → `body.density-compact` (rules already in `screens.css`).
- **Mobile board layout** → timeline / grid (pairs with #5).

### UI
- `TweaksPanelComponent` toggled from a nav gear button; sliders/segmented toggles styled with the existing `.btn`/`.chip` kit.
- The prototype's "Reset campaign data" button is **N/A** — your state lives in Supabase, not localStorage.

---

## Suggested sequence & rough effort

| # | Feature | Backend | Effort | Notes |
|---|---|---|---|---|
| 1 | Seal / lock | new table + trigger | M | Gate everything else depends on |
| 2 | Duty cover | 1 column | S | Builds on #1 |
| 3 | Correction | new table | M | Needs #1, #2 (ledger) |
| 4 | Spotlight | 1 column + log table | M | Independent |
| 5 | Mobile timeline | none | M–L | `day-row` template/SCSS |
| 6 | Tweaks panel | none | S–M | Mostly CSS-var plumbing |

**Recommended first slice:** #1 + #6 (lock gives the system stakes; the tweaks panel is cheap polish), then #2/#3 together (they share the duty ledger), then #4, then #5 when you want the phone experience.
