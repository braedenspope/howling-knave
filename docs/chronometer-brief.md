# The Chronometer — In-Game Calendar Module
## Claude Code Build Brief (Echoes of the Sundering / Howling Knave training app)

> Paste this file into the training app repo (e.g. `docs/chronometer-brief.md`) and tell Claude Code: *"Build the Chronometer module as specified in docs/chronometer-brief.md. Start with the pure calendar engine and its tests, then the Supabase schema, then the UI."*

---

## 0. Summary

Add a module to the existing **Angular + Supabase** training app that tracks the current in-game date for the campaign *Echoes of the Sundering*, using the world of Argous's own calendar. The DM advances or sets the date; players can always see it. The DM can attach dated events (DM-only or player-visible) and private per-day notes.

**Hard rules**
- The calendar engine is a **pure TypeScript library** with no Angular or Supabase imports. Everything else consumes it.
- The calendar's structure (months, weekdays, festivals) is **canon**: hardcode it as constants from §2 below. Do not put it in the database. Do not invent additional months, days, or festivals.
- Only one unit of time: **whole days**. No hours, watches, or blocks.
- **DM only** may change the clock or create/edit events. Players are read-only.
- Players must never be able to read DM-only events or notes — enforce with Row Level Security, not just UI.

---

## 1. The Calendar of Argous (canon — implement exactly)

### 1.1 Year structure
- A year has **10 months of 36 days each** (360 days), followed by **5 intercalary days called the Veildays** (collectively **Veiltide**), which belong to no month and no week.
- Every **fourth year** a sixth Veilday, the **Long Veil**, is added. Rule for this app: **a year is a Long Veil year when `year % 4 === 0`** (so 1,248 A.S. is one; 1,247 is not).
- Year length: 365 days, or 366 in a Long Veil year.

### 1.2 Months (in order)

| # | Name | Folk name |
|---|---|---|
| 1 | Primis | Firstmonth |
| 2 | Senda | Snowwane |
| 3 | Tersel | Seedmonth |
| 4 | Quarrow | Greenmonth |
| 5 | Quinter | Half-Year |
| 6 | Sestal | Highsun |
| 7 | Septena | Goldmonth |
| 8 | Ottis | Harvestmonth |
| 9 | Noven | Fademonth |
| 10 | Dessima | The Dying |
| — | *Veiltide* (the Veildays) | "the days without names" |

### 1.3 The six-day week
Weekdays, in order: **Hearthday, Vyrday, Lilsday, Farday, Thessday, Seaday**.

Because 36 is divisible by 6, **every month begins on Hearthday** and a given day-of-month always falls on the same weekday. Weekday is therefore a function of day-of-month only:
`weekdayIndex = (dayOfMonth - 1) % 6` (0 = Hearthday … 5 = Seaday).
The Veildays have **no weekday**.

### 1.4 Epochs
- **A.S.** (After the Sundering) is the master count. **Current campaign year: 1,247 A.S.** Display years with a thousands separator: `1,247 A.S.`
- Engine must also expose conversions (not shown in UI for now): `I.R. = A.S. − 177`, `C.C. = A.S. − 890`.

### 1.5 Absolute day numbering
Define `absDay` as an integer where **`absDay = 0` is 1 Primis, Year 0 A.S.** All storage uses `absDay`. The engine converts `absDay ⇄ { year, month, day }` where `month` is 1–10, or `11` for the Veildays (day 1–5, or 1–6 in a Long Veil year).

Number of leap (Long Veil) years strictly before year `Y`, with the `% 4` rule and year 0 counted: `Math.floor((Y + 3) / 4)`.

### 1.6 Moons
- **Selein**, the natural moon: a **30-day** cycle. Phases, in order, each 3.75 days: New, Waxing Crescent, First Quarter, Waxing Gibbous, Full, Waning Gibbous, Last Quarter, Waning Crescent. Cycle day = `((absDay - seleinNewAnchor) mod 30 + 30) mod 30`; phase = `Math.floor(cycleDay / 3.75)`. `seleinNewAnchor` is a configurable constant; **default: New Moon on 1 Primis 1,247 A.S.**
- **The Stillstar**: does not move, rise, set, or change. The almanac shows one fixed line beneath Selein: *"The Stillstar holds its station."* No computation.

### 1.7 Festivals (constant table)
Each festival has `name`, `kind` (`shared` | `faith` | `national` | `veil`), `nation` (optional), a `match(date)` rule, and a short player-safe `blurb`. Multi-day festivals return `true` for every day in the span.

**Fixed single days**

| Festival | Date | Kind / Nation | Blurb |
|---|---|---|---|
| Firstlight | 1 Primis | shared | The new year is called in with lamps and beacons at dawn. |
| The Stillwatch | 18 Primis | faith | Folk sit up through the deep-winter night to watch the Stillstar. |
| The Tending | 23 Senda | faith | Theslyn's high day; healers work without fee, graves are cleared, mourners fed. |
| Seedwake | 36 Senda | shared | Seed-grain is blessed, sung over, and traded on winter's last day. |
| Firstfurrow | 6 Tersel | shared | The year's first furrow cut at dawn; the plow garlanded. |
| Charter Day | 15 Tersel | national / Prairie Commonwealth | Anniversary of the Commonwealth Charter; civic fairs and public readings. |
| The Binding | 15 Quarrow | shared | The yearly renewal of oaths, apprenticeships, and marriages. |
| The Kindling | 9 Quinter | faith | The Pyre Clergy's flame-rite; embers carried from temple to hearth. |
| The Half-Turn (Sundering Day) | 36 Quinter | shared | The anniversary of the Sundering; every nation keeps it differently. |
| Longlight | 18 Sestal | shared | The longest day; straw sun-wheels raised at dawn and burned at dusk. All work stops at noon. |
| The Far-Calling | 4 Septena | faith | Aelorun's festival; letters to the distant, bargains struck at dawn, travelers fed free. |
| Harvest Home | 30 Ottis | shared | The great ingathering feast; the last sheaf carried in procession. |
| Ascendance Festival | 12 Noven | national / Sovereign Empire | Anniversary of the Empire's declaration; flame-games and pageantry. |
| Gravetide | 29 Noven | shared | The day of the dead; lamps set on graves and on the water. |
| Forgetide | 1 Dessima | national / Ironheart Federation | The great forges relit for winter; apprentices show their first year's work. |

**Spans**

| Festival | Days | Kind / Nation | Blurb |
|---|---|---|---|
| The Verdancy | 1–6 Quarrow | national / Sylvan Concordat | Tree-blessing and renewal rites through the forest cities. |
| The High Winds | 31–36 Sestal | national / Skybourne Reaches | Gusthaven's aerial games on the summer thermals. |
| The Salt Court | 16–21 Septena | national / Pirate Isles | The Council of Salt convenes; races, duels, and markets of things no customs house sees. |
| Veiltide | every Veilday | veil | The days without names. Debts settled or forgiven, hearths relit, masks in the streets. |

---

## 2. Calendar engine (`src/app/chronometer/engine/`)

Pure TS, fully unit-tested (Jest/Vitest — whatever the repo already uses). Public API:

```ts
export interface ArgousDate { year: number; month: number /* 1–10, 11 = Veildays */; day: number; }

export const MONTHS: readonly { name: string; folk: string }[];     // 10 entries
export const WEEKDAYS: readonly string[];                           // 6 entries
export const FESTIVALS: readonly Festival[];

export function isLongVeilYear(year: number): boolean;
export function daysInYear(year: number): number;                   // 365 | 366
export function toAbsDay(d: ArgousDate): number;
export function fromAbsDay(abs: number): ArgousDate;
export function addDays(abs: number, n: number): number;            // trivial, but exported for clarity
export function weekdayOf(d: ArgousDate): string | null;            // null on Veildays
export function formatDate(d: ArgousDate, opts?: { folk?: boolean }): string;
export function toImperialYear(asYear: number): number;             // − 177
export function toCharterYear(asYear: number): number;              // − 890
export function seleinPhase(abs: number, anchor?: number): { name: string; cycleDay: number };
export function festivalsOn(d: ArgousDate): Festival[];
export function nextFestival(abs: number): { festival: Festival; absDay: number; daysUntil: number }; // strictly after `abs`; wraps into next year
```

**Formatting**
- Normal day: `Seaday, 12 Tersel, 1,247 A.S.` — with `folk: true`: `Seaday, 12 Seedmonth, 1,247 A.S.`
- Veilday: `Veiltide — 3rd Veilday, 1,247 A.S.` (ordinal suffixes 1st…6th).

**Validation**: `toAbsDay` throws on month outside 1–11, day outside 1–36, Veilday outside 1–5 (1–6 in a Long Veil year).

### 2.1 Acceptance tests (must pass)

```
fromAbsDay(0)                       → { year: 0, month: 1, day: 1 }, weekday "Hearthday"
toAbsDay({1247, 3, 12})              → round-trips through fromAbsDay
weekdayOf({1247, 3, 12})             → "Seaday"          // campaign start
weekdayOf({1247, 3, 15})             → "Lilsday"         // Charter Day
weekdayOf({1247, 5, 36})             → "Seaday"          // Half-Turn
weekdayOf({1247, 1, 18})             → "Seaday"          // Stillwatch
weekdayOf({1247, 2, 23})             → "Thessday"        // Tending
weekdayOf({1247, 7, 4})              → "Farday"          // Far-Calling
weekdayOf({1247, 9, 29})             → "Thessday"        // Gravetide
weekdayOf({1247, 11, 2})             → null
isLongVeilYear(1247)                 → false
isLongVeilYear(1248)                 → true
daysInYear(1248)                     → 366
addDays(toAbsDay({1247,10,36}), 1)   → {1247, 11, 1}
addDays(toAbsDay({1247,10,36}), 6)   → {1248, 1, 1}      // 5 Veildays then Firstlight
addDays(toAbsDay({1248,10,36}), 7)   → {1249, 1, 1}      // 6 Veildays in a Long Veil year
toAbsDay({1247,11,6})                → throws (1247 has only 5 Veildays)
toAbsDay({1248,11,6})                → ok
formatDate({1247,3,12})              → "Seaday, 12 Tersel, 1,247 A.S."
formatDate({1247,11,3})              → "Veiltide — 3rd Veilday, 1,247 A.S."
toImperialYear(1247)                 → 1070
toCharterYear(1247)                  → 357
festivalsOn({1247,3,15})             → [Charter Day]
festivalsOn({1247,4,3})              → [The Verdancy]
festivalsOn({1247,11,1})             → [Veiltide]
nextFestival(toAbsDay({1247,3,12}))  → Charter Day, daysUntil 3
nextFestival(toAbsDay({1247,10,1}))  → Veiltide, daysUntil 36   // Forgetide is today, so next is Veiltide
seleinPhase(toAbsDay({1247,1,1})).name → "New"
```

---

## 3. Supabase schema

Reuse the app's existing campaign / membership / role mechanism. If the app has no DM-vs-player role concept yet, add `campaign_members (campaign_id, user_id, role text check (role in ('dm','player')))` and a helper `is_dm(campaign_id uuid) returns boolean` (security definer) used by all policies below.

```sql
create table campaign_clock (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  current_abs_day integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  abs_day integer not null,
  title text not null,
  body text,
  visibility text not null check (visibility in ('dm','player')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on calendar_events (campaign_id, abs_day);

create table calendar_day_notes (            -- DM-only private notes, one per day
  campaign_id uuid not null references campaigns(id) on delete cascade,
  abs_day integer not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, abs_day)
);

alter table campaign_clock      enable row level security;
alter table calendar_events     enable row level security;
alter table calendar_day_notes  enable row level security;

-- clock: every member reads; only DM writes
create policy clock_read  on campaign_clock for select using (is_member(campaign_id));
create policy clock_write on campaign_clock for all    using (is_dm(campaign_id)) with check (is_dm(campaign_id));

-- events: DM sees all; players see only visibility = 'player'
create policy events_read_dm     on calendar_events for select using (is_dm(campaign_id));
create policy events_read_player on calendar_events for select using (is_member(campaign_id) and visibility = 'player');
create policy events_write       on calendar_events for all    using (is_dm(campaign_id)) with check (is_dm(campaign_id));

-- notes: DM only, both ways
create policy notes_all on calendar_day_notes for all using (is_dm(campaign_id)) with check (is_dm(campaign_id));
```

Enable Supabase Realtime on `campaign_clock` and `calendar_events` so player screens update the moment the DM advances the day.

### 3.1 Seed data (campaign start)
- `campaign_clock.current_abs_day` = `toAbsDay({ year: 1247, month: 3, day: 12 })` (Seaday, 12 Tersel, 1,247 A.S.).
- Seed events (DM may delete):
  - **14 Tersel 1,247** — `dm` — "The Keeper charters the *Howling Knave* — evening."
  - **15 Tersel 1,247** — `dm` — "Basin Commission sits — Charter Day."

---

## 4. Angular UI

Lazy-loaded feature module `chronometer` under an `/almanac` route, plus a small shared component for the app header. Follow the app's existing component conventions, theming, and auth guard patterns.

### 4.1 `<app-date-banner>` (everyone, in the app shell header)
One line, always visible: **`Seaday, 12 Tersel, 1,247 A.S.`**. If today is a festival, append it in a muted badge: `· Charter Day`. Clicking opens `/almanac`.

### 4.2 `/almanac` — player view (everyone)
- Large formatted date; folk month-name beneath it (`Seedmonth`).
- **Selein** phase name with a simple phase glyph; beneath it the fixed Stillstar line.
- **Next festival**: name, date, `in N days`, blurb.
- **Upcoming**: the next 12 in-game days as a list — each row shows weekday + date, any festival, and any `player`-visible events. Rows for past days are not shown here.
- **Almanac log** (read-only): all `player` events, newest first, grouped by day.
- No controls of any kind.

### 4.3 `/almanac` — DM additions (rendered only when `is_dm`; writes also guarded by RLS)
- **Clock controls**: `+1 day`, `+6 days`, `+N` (numeric input), and **Set date** (year / month-or-Veiltide / day pickers, validated by the engine). Every change writes `campaign_clock` and shows a confirmation toast with the new date.
- **Events**: create / edit / delete with title, body, date, and a **visibility toggle (DM / Players)**. DM-only events show with a lock icon everywhere in the DM's view.
- **Pending board**: all events on or after today, soonest first, DM and player both, with a visibility badge. Events whose day is *today* are highlighted.
- **Day notes**: a textarea for the currently viewed day (today by default; the DM can click any upcoming row to view/edit that day's note). Autosave on blur.

### 4.4 Service surface (`ChronometerService`)
```ts
currentAbsDay$: Observable<number>;
currentDate$:   Observable<ArgousDate>;
advanceDays(n: number): Promise<void>;   // DM
setDate(d: ArgousDate): Promise<void>;   // DM
events$(fromAbs: number, toAbs: number): Observable<CalendarEvent[]>;
```
`advanceDays` is the single entry point the voyage/training module may call later; do **not** wire any automatic advancement now.

---

## 5. Out of scope (do not build)
- Hours, watches, or 8-block days on the clock.
- Imperial / Charter year display, or per-player epoch toggles.
- Player-created events or any player write path.
- Automatic advancement from the voyage system.
- Any DB table for months, weekdays, or festivals.

---

## 6. Definition of done
1. Engine tests in §2.1 all pass.
2. A player account can see the banner and `/almanac` but receives zero `dm` events and zero day notes from Supabase (verify by querying as a player — not only by hiding UI).
3. DM advances the day; a player's open screen updates without refresh.
4. Advancing past 36 Dessima walks through Veiltide and lands on Firstlight with the correct number of Veildays for the year.

---

## Canon & Revision Ledger

### Preserved Canon
- Year structure, month names and folk names, six-day week, fixed-weekday law, epochs and conversions, Selein's ~30-day cycle, the Stillstar's fixed station, and every festival name, date, and blurb — all from *The Calendar of Argous — World Canon Document*. Player-facing blurbs carry no DM-secret material.
- Campaign start **Seaday, 12 Tersel, 1,247 A.S.**; the Keeper's charter on the evening of 14 Tersel and the Basin Commission sitting on Charter Day, per the *EotS Campaign Ledger*.

### Newly Ratified Rulings (this revision — Braeden's selections)
- The Chronometer is a module inside the training app (1a), Angular + Supabase (2).
- DM-only control of the clock (3a); whole days as the only unit (4a).
- Player face shows date/weekday/folk-name/year in A.S., Selein and the Stillstar, and the next festival (5a, 5c, 5d). No epoch toggle; no scrollable captioned day-log beyond player events.
- DM side has clock controls plus private per-day notes and a pending-events list, with events creatable as DM-only or player-visible (6a, 6b, expanded).

### Invented Incidentals (awaiting the Lore Master's seal)
- **Long Veil rule:** a year is a Long Veil year when `year % 4 === 0` (so 1,248 A.S.). The canon says only "every fourth year."
- **Selein anchor:** New Moon on 1 Primis 1,247 A.S. by default — the canon fixes no phase to any date.
- **Selein phase names:** the standard eight-phase sequence.
- **Fixed spans** for canon's loose dates: the Verdancy 1–6 Quarrow ("first week"), the High Winds 31–36 Sestal ("late Sestal"), the Salt Court 16–21 Septena ("mid-Septena").
- **Veilday formatting:** `Veiltide — 3rd Veilday, 1,247 A.S.`
- The Stillstar's almanac line: *"The Stillstar holds its station."*

### Governing Files
- *The Calendar of Argous — World Canon Document* governs all dates, festivals, and moons. If the app and the document ever disagree, the document wins and the constants are corrected.
