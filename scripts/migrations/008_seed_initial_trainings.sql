-- Seed: Howling Knave — Initial Crew Training Paths (campaign start).
--
-- Wipes existing trainings + progress and loads the canonical initial set:
-- 11 crew members x 3 trainings, each with its prescribed sessions, plus the
-- six hidden character bonuses.
--
-- Requires 007_training_pp_system.sql first. Run in the Supabase SQL editor.
-- All prose uses $hk$ dollar-quoting so apostrophes/quotes need no escaping.

-- ---- ensure every crew member exists (insert missing only) ----
insert into public.crew_members (name, role)
select v.name, v.role
from (values
  ($hk$Anna Rose$hk$,      $hk$Captain$hk$),
  ($hk$Guner Aldric$hk$,   $hk$First Mate$hk$),
  ($hk$Rachel Rose$hk$,    $hk$Ship's Surgeon$hk$),
  ($hk$Lehiri Stars$hk$,   $hk$Navigator$hk$),
  ($hk$Toji Brassboot$hk$, $hk$Quartermaster$hk$),
  ($hk$Porter Tomas$hk$,   $hk$Cargo Master$hk$),
  ($hk$Shanoa Buckler$hk$, $hk$Master-at-Arms$hk$),
  ($hk$Ardor$hk$,          $hk$Passenger$hk$),
  ($hk$Bryce Morrison$hk$, $hk$Bosun's Apprentice$hk$),
  ($hk$Elro Boldfall$hk$,  $hk$Ship's Cook$hk$),
  ($hk$Delvin Moss$hk$,    $hk$Deckhand · Herbalist$hk$)
) as v(name, role)
where not exists (
  select 1 from public.crew_members c where c.name = v.name
);

-- ---- wipe existing training data (cascades to sessions + hidden bonuses) ----
delete from public.training_progress;
delete from public.trainings;

-- =====================================================================
-- ANNA ROSE — Captain
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Anna Rose$hk$),
    $hk$The Hand$hk$,
    $hk$Anna teaches the physical craft of sleight of hand — palming objects, passing things unseen, misdirecting attention. She learned this young. She teaches it without ceremony.$hk$,
    $hk$+1 to Sleight of Hand checks$hk$,
    $hk$Anna is a patient teacher for repetition-based work — she knows it takes time because it took her time. By the third session she asks, in passing, what the player intends to use it for. The answer matters to her, even if she doesn't say so.$hk$,
    'light', 3, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Dexterity$hk$, 1, 0),
  (2, 'light', $hk$Sleight of Hand$hk$, 1, 0),
  (3, 'light', $hk$Sleight of Hand$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Anna Rose$hk$),
    $hk$The Blade$hk$,
    $hk$Anna fights with a rapier the way most people breathe — without thinking about it. She doesn't teach fencing theory. She teaches the half-dozen things that actually keep you alive in a real fight with a blade in your hand.$hk$,
    $hk$+1 to attack rolls with rapiers$hk$,
    $hk$Anna spars without holding back, which is either alarming or instructive depending on the player. She gives corrections once. She doesn't repeat them. By the end of the second session a player who has been paying attention will realise she fights like someone who was taught to win, not to look good doing it.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Dexterity$hk$, 2, 1),
  (2, 'medium', $hk$Attack roll (rapier)$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Anna Rose$hk$),
    $hk$The Mark$hk$,
    $hk$Anna teaches players to observe behaviour rather than appearance — how to identify what a person wants, spot their tells, and determine whether they are lying. Drawn from Jack Rose's lessons and two years navigating the complicated loyalties of crews, ports, and naval politics.$hk$,
    $hk$+1 to Insight checks$hk$,
    $hk$Anna is precise and unsentimental teaching this. She doesn't romanticise her father's skills — she uses them. Over the three sessions she lets slip more than she intends about Jack. By the end the player understands: she learned this to survive him, not because of him.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Insight$hk$, 2, 1),
  (2, 'light', $hk$Wisdom$hk$, 1, 0),
  (3, 'heavy', $hk$Insight$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Kazali Feld$hk$,
  $hk$Kazali has spent ten years reading faces she was wearing and faces she was watching. Anna recognises this immediately — she isn't teaching Kazali to observe. She's teaching her to trust what she already sees. The final session becomes less a lesson and more a conversation between two people who have always known the room.

Additional benefit: Once per long rest, Kazali may declare she has been reading a specific NPC since entering the scene. The DM must reveal whether that NPC is concealing an active intention — not the intention itself, but whether one exists.

Anna tells her afterwards: "You already knew. You were just waiting for permission."$hk$
from public.trainings
where topic = $hk$The Mark$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Anna Rose$hk$);

-- =====================================================================
-- RACHEL ROSE — Mage / Healer
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Rachel Rose$hk$),
    $hk$The Body Remembers$hk$,
    $hk$Rachel teaches practical field medicine — how to stabilise a wound, identify what kind of healing is appropriate, and spot secondary damage that a basic healing spell might miss. She is professionally precise and a surprisingly good teacher when given a willing student.$hk$,
    $hk$+1 to Medicine checks$hk$,
    $hk$Rachel is reserved but competent in this mode — teaching grounds her. In the second session she mentions her mother almost without meaning to. She doesn't offer more. But she doesn't take it back.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Wisdom$hk$, 1, 0),
  (2, 'medium', $hk$Medicine$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Rachel Rose$hk$),
    $hk$The Living Current$hk$,
    $hk$Rachel introduces players to the elven philosophy of treating magic as a relationship rather than a tool — reading ambient resonance, feeling the shape of a spell before it is cast, and understanding why some magic responds and some resists. For non-casters this reframes as learning to recognise magical presence in objects and spaces.$hk$,
    $hk$+1 to Arcana checks$hk$,
    $hk$Rachel asks genuine questions about the player's own relationship to magic or instinct. By the second session she is less guarded than she started. She hasn't let anyone into this particular room in a long time.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Arcana$hk$, 2, 1),
  (2, 'medium', $hk$Intelligence$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Aldore$hk$,
  $hk$Aldore's magic did not come from study — it surfaced on its own, from something older than any tradition Rachel has encountered. When she asks about his relationship to magic and he answers honestly, she goes very quiet. What he describes is not sorcery or wizardry. It is living-magic. It has always been living-magic. She doesn't fully understand what he is, but she understands what his magic is, and it changes how she teaches the rest of the training.

Additional benefit: Aldore gains advantage on Arcana checks made to identify or understand Precursor magical constructs, nodes, or artifacts specifically.

Rachel tells him quietly at the end: "Whatever you are, the magic in you is not wrong. It is very, very old. And it knows what it's doing."$hk$
from public.trainings
where topic = $hk$The Living Current$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Rachel Rose$hk$);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Rachel Rose$hk$),
    $hk$The Kit$hk$,
    $hk$Rachel teaches the full working use of a Healer's Kit — not just staunching wounds, but knowing what each component does, when to use it, and how to improvise when the kit runs short. She considers this foundational. She is quietly appalled that it isn't more widely known.$hk$,
    $hk$Healer's Kit proficiency. If already proficient, +1 to Medicine checks.$hk$,
    $hk$Rachel teaches this methodically and with visible investment — she wants people around her to be able to help. By the third session she has relaxed enough to mention that she started learning this because she couldn't always rely on someone else knowing it. She doesn't say when. The player can ask.$hk$,
    'light', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Medicine$hk$, 1, 0),
  (2, 'heavy', $hk$Wisdom$hk$, 3, 1),
  (3, 'light', $hk$Medicine$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- GUNER ALDRIC — First Mate
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Guner Aldric$hk$),
    $hk$The Line$hk$,
    $hk$Guner runs structured weapons drills — not to teach fancy form, but to build the muscle memory that keeps a fighter alive when panic sets in. The player declares their weapon at the start. Guner adjusts everything to fit it.$hk$,
    $hk$+1 to attack rolls with one martial weapon of the player's choice$hk$,
    $hk$Guner is a demanding but not cruel teacher. He asks about the player's training background by the second session — genuinely curious, not critical. Whatever they say, he adjusts his approach accordingly and does not comment on the adjustment.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Athletics$hk$, 2, 1),
  (2, 'heavy', $hk$Attack roll (chosen weapon)$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Guner Aldric$hk$),
    $hk$The Hold$hk$,
    $hk$Physical conditioning — grip strength, grappling fundamentals, the ability to hold a position or a person when it matters. Unglamorous. Guner does it alongside the player.$hk$,
    $hk$+1 to Athletics checks$hk$,
    $hk$Guner says little during the physical work itself. During the cooldown at the end of the second session, catching breath on the deck, he says something about the cost of his discipline that he doesn't usually permit himself to say aloud.$hk$,
    'medium', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Athletics$hk$, 2, 1),
  (2, 'light', $hk$Strength$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Guner Aldric$hk$),
    $hk$The Address$hk$,
    $hk$Guner teaches how to give an order that people will follow — not through rank, but through clarity, conviction, and the specific quality of meaning what you say. He has watched commanders lose crews not through bad tactics but through bad communication. He does not intend to do the same.$hk$,
    $hk$+1 to Persuasion checks$hk$,
    $hk$Guner teaches this through examples — moments he has witnessed or been part of. By the second session he concedes, quietly, that Anna has made calls he would not have made and been right. He doesn't expand on it. The concession is the point.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Persuasion$hk$, 2, 1),
  (2, 'medium', $hk$Charisma$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- BRYCE MORRISON — General Crew
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Bryce Morrison$hk$),
    $hk$The Performance$hk$,
    $hk$Bryce turns out to be a natural performer — not polished, but genuinely engaging in a way that is hard to manufacture. He teaches the player to stop worrying about being good and start worrying about being present. The lesson is more useful than it sounds.$hk$,
    $hk$+1 to Performance checks$hk$,
    $hk$Bryce teaches this by doing it badly on purpose first, then doing it well, then explaining the difference. By the second session he has coaxed the player into performing something themselves. Whatever they do, he reacts as though it was exactly right. He is not being diplomatic — he genuinely means it.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Charisma$hk$, 1, 0),
  (2, 'medium', $hk$Performance$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Bryce Morrison$hk$),
    $hk$The Surge$hk$,
    $hk$Bryce teaches resistance to magical compulsion drawn from his experience with wild magic — not control, but the specific quality of not being swept away. He has had to find himself in the middle of chaos more than once. He knows what that anchor feels like and can teach others to find it.$hk$,
    $hk$+1 to Charisma saving throws$hk$,
    $hk$Bryce explains this through stories about his surges — specific moments, which ones nearly took him somewhere he couldn't come back from, and what he held onto. By the second session the player understands the training isn't about magic theory. It is about knowing who you are when something is trying to tell you otherwise.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Charisma$hk$, 2, 1),
  (2, 'heavy', $hk$Charisma saving throw$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Varus Alderin$hk$,
  $hk$Varus is a wild magic sorcerer whose magic is tangled with Feywild origin and Aasimar heritage — a combination Bryce cannot name but immediately recognises the shape of. Two people from elsewhere, carrying chaos they didn't ask for. The training stops being instruction and starts being commiseration. Bryce teaches Varus the anchor the way he found it himself: not control, but identity. You know who you are. Hold onto that.

Additional benefit: When Varus rolls on the wild magic surge table, he may roll twice and choose which result occurs. Once per long rest.

Bryce's note at the end, delivered without ceremony: "The chaos isn't the problem. Forgetting yourself is."$hk$
from public.trainings
where topic = $hk$The Surge$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Bryce Morrison$hk$);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Bryce Morrison$hk$),
    $hk$The Wood$hk$,
    $hk$Bryce learned woodworking where he came from and carried the skill into a world with entirely different wood. He finds this faintly absurd and completely grounding. He teaches it because working with his hands is the one thing that has always felt the same regardless of which world he's in.$hk$,
    $hk$Woodworker's Tools proficiency. If already proficient, +1 to checks made with Woodworker's Tools.$hk$,
    $hk$Bryce talks the entire time he works, which turns out to be a feature rather than a distraction — the work occupies his hands and loosens everything else. By the third session he has mentioned his home world more directly than he usually permits himself to. He notices, and moves on. The player can follow up or leave it.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Dexterity$hk$, 2, 1),
  (2, 'medium', $hk$Woodworker's Tools$hk$, 2, 1),
  (3, 'light', $hk$Intelligence$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- DELVIN MOSS — Quartermaster (deck role)
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Delvin Moss$hk$),
    $hk$The Deck$hk$,
    $hk$Delvin teaches cards — not as gambling, but as a social tool. How to read a table, manage your tells, lose on purpose when you need to, and win without anyone being certain how. He has more than a century of practice and makes it look effortless. It is not effortless.$hk$,
    $hk$Playing Cards proficiency. If already proficient, +1 to Sleight of Hand checks made with cards.$hk$,
    $hk$Delvin teaches with stories folded into every hand — most of them true, all of them illustrative. By the second session the player realises Delvin has been quietly reading them the entire time. He confirms this cheerfully if asked.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Insight$hk$, 1, 0),
  (2, 'medium', $hk$Sleight of Hand$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Delvin Moss$hk$),
    $hk$The Long Memory$hk$,
    $hk$Delvin has lived through more of Argous's recent history than most libraries contain. He teaches not dates and names but the patterns underneath them — why things happened, who benefited, and how the same mistakes keep wearing different clothes. More than a century of watching has made him an exceptional interpreter of the past.$hk$,
    $hk$+1 to History checks$hk$,
    $hk$Delvin teaches through anecdote and the anecdotes are real. By the second session the player begins to understand the scale of what Delvin has actually witnessed. At some point he references an event as though it was last year and then does the arithmetic aloud. He does not appear troubled by the number.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$History$hk$, 2, 1),
  (2, 'medium', $hk$Intelligence$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Delvin Moss$hk$),
    $hk$The Story$hk$,
    $hk$Delvin teaches the art of the tale — how to frame information for maximum impact, defuse tension with the right anecdote, and make people feel that giving you what you want was their idea. He considers this the most useful skill he owns and teaches it with the seriousness it deserves.$hk$,
    $hk$+1 to Performance checks$hk$,
    $hk$Delvin is the most enjoyable teacher on the ship and, unexpectedly, the most honest across these three sessions. Every story he uses as an example is real. By the third he uses the Stormbreaker — not as a tragedy, but as the story he tells himself about why every day after is a gift he intends to use. He doesn't perform it. He just says it.$hk$,
    'light', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Charisma$hk$, 1, 0),
  (2, 'medium', $hk$Performance$hk$, 2, 1),
  (3, 'heavy', $hk$Persuasion$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- PORTER TOMAS — General Crew
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Porter Tomas$hk$),
    $hk$The Step$hk$,
    $hk$Porter teaches movement — how to keep your footing on a ship deck, an uneven street, or anything in between. How to fall without breaking. How to get back up fast. Small things that matter enormously when the situation goes wrong.$hk$,
    $hk$+1 to Acrobatics checks$hk$,
    $hk$Porter teaches this practically and without commentary. He demonstrates, corrects, and moves on. He is not unfriendly — he is just economical. By the second session a player paying attention will notice that every technique he demonstrates has been used in a real situation. None of it is theoretical.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Dexterity$hk$, 1, 0),
  (2, 'medium', $hk$Acrobatics$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Porter Tomas$hk$),
    $hk$The Threat$hk$,
    $hk$Porter teaches intimidation — how to read whether someone is actually dangerous, how to project threat without throwing a punch, and when walking away is the correct victory. Grounded in fifteen years of piracy, street violence, and survival.$hk$,
    $hk$+1 to Intimidation checks$hk$,
    $hk$Porter teaches this reluctantly. He frames the entire training around who you are protecting. The most dangerous version of this skill, he says, is the one used without asking that question first. He used it that way for a long time. He does not say what that cost.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Insight$hk$, 2, 1),
  (2, 'medium', $hk$Intimidation$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Porter Tomas$hk$),
    $hk$The Dirty Way$hk$,
    $hk$Porter teaches how to win fights that should not be fair — hitting first, hitting where it hurts, using the environment, ensuring the other person does not get a second chance to be a problem. No form. No ceremony. Just results. These are not drills. They are what he did to stay alive.$hk$,
    $hk$+1 to attack rolls with unarmed strikes and improvised weapons$hk$,
    $hk$Porter never demonstrates anything he hasn't personally used. A player who notices this and says so will get one short, honest answer before Porter moves on. Tula comes up exactly once across the three sessions — not her death, but something she said about fighting. He doesn't notice he has mentioned her. He doesn't stop.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Athletics$hk$, 2, 1),
  (2, 'medium', $hk$Attack roll (unarmed)$hk$, 2, 1),
  (3, 'light', $hk$Strength$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Korrn$hk$,
  $hk$Porter was part of Blackheart's organisation when the forge burned. He was not the one who lit the fire — but he was there, earlier, when they came to collect the branding iron. He remembers the smith. He remembers the refusal. Whether he recognises Korrn across these sessions is a roll (Insight DC 14, Porter's side — the DM rolls privately). If he recognises him, he says nothing during the training. He finishes all three sessions. At the end, he sits down and tells Korrn what he knows about that night, about who gave the order, and about the man who said no with one word and placed it on the counter like something heavier than the anvil. He does not ask forgiveness.

Additional benefit: Korrn gains advantage on attack rolls against targets who have harmed someone he is protecting.

Porter tells him: "The ones who burn things down to send a message — they're the ones you hit like you mean it."$hk$
from public.trainings
where topic = $hk$The Dirty Way$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Porter Tomas$hk$);

-- =====================================================================
-- TOJI BRASSBOOT — Engineer
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Toji Brassboot$hk$),
    $hk$The System$hk$,
    $hk$Toji walks the player through the Howling Knave's systems — how every component connects, what each one does, and why the whole thing is more elegant than it looks. He wants someone to see what he sees. He teaches by asking questions until the player starts asking their own.$hk$,
    $hk$+1 to Investigation checks$hk$,
    $hk$Toji talks the entire time — about the crystals, the theory, the beautiful inefficiency of the original Commonwealth design and everything he has improved upon it. By the second session he asks if the player has an eye for beautiful things. Whatever they say, he nods seriously and shows them one more thing.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Intelligence$hk$, 1, 0),
  (2, 'medium', $hk$Investigation$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Toji Brassboot$hk$),
    $hk$The Current$hk$,
    $hk$Toji understands magical engineering the way a surgeon understands anatomy — from the inside. He teaches the player how arcane energy moves through constructed systems, why some materials conduct it and others resist, and how to read a magical mechanism without touching it.$hk$,
    $hk$+1 to Arcana checks$hk$,
    $hk$Toji is more careful here than in his other teaching — he loves this subject and that makes him precise about it. By the second session he admits he has never fully explained this to anyone before because most people stop listening before it gets interesting. The player, having not stopped, receives the interesting part.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Arcana$hk$, 2, 1),
  (2, 'medium', $hk$Investigation$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Toji Brassboot$hk$),
    $hk$The Tools$hk$,
    $hk$Toji teaches proper tool use — not just which tool for which job, but how to maintain them, how to adapt them, and how to treat them as extensions of thought rather than simple instruments. He considers careless tool use a moral failing.$hk$,
    $hk$Tinker's Tools proficiency. If already proficient, +1 to checks made with Tinker's Tools.$hk$,
    $hk$Toji is the most particular teacher on the ship. He will stop a session to correct a grip. He will not apologise for this. By the third session he presents the player with a small tool he has made specifically for them — something he noticed they needed during the training and built without mentioning it. He hands it over without ceremony.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Dexterity$hk$, 2, 1),
  (2, 'light', $hk$Intelligence$hk$, 1, 0),
  (3, 'heavy', $hk$Tinker's Tools$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- LEHIRI STARS — Navigator
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Lehiri Stars$hk$),
    $hk$The Chart and the Sky$hk$,
    $hk$Lehiri teaches the player to read the world — celestial navigation, weather patterns from the sky, and how to determine where you are and where conditions are moving. Not theory. Real tools for real situations.$hk$,
    $hk$+1 to Survival checks$hk$,
    $hk$Lehiri folds questions into every lesson — she is testing how the player thinks, not whether they can repeat what she says. By the end of the second session she notes, without elaboration, that she learned this because knowing your exits matters more than knowing your destination.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Wisdom$hk$, 1, 0),
  (2, 'medium', $hk$Survival$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Lehiri Stars$hk$),
    $hk$The Watch$hk$,
    $hk$Lehiri teaches sustained observation — how to maintain attention across long periods, how to notice the thing that changed rather than what was always there, and how to watch a horizon without seeing only what you expect. The skill that keeps a ship from sailing into trouble.$hk$,
    $hk$+1 to Perception checks$hk$,
    $hk$Lehiri is visibly more comfortable teaching this than making conversation. This is how she thinks. This is how she has survived. Midway through the second session she asks the player what they are watching for — not as a training question, but as a real one. Whatever the answer, she files it away and says nothing.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Perception$hk$, 2, 1),
  (2, 'heavy', $hk$Wisdom$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Lehiri Stars$hk$),
    $hk$The Instrument$hk$,
    $hk$Lehiri teaches the full working use of navigator's tools — charts, sextants, chronometers, and the calculations that tie them together. She is meticulous and does not tolerate approximation. She also teaches what to do when the instruments are wrong or missing.$hk$,
    $hk$Navigator's Tools proficiency. If already proficient, +1 to checks made with Navigator's Tools.$hk$,
    $hk$Lehiri teaches this training differently from the others — she is quieter, more focused, less inclined to ask questions. By the third session the player understands that this is not distance. It is respect. She teaches it this carefully because it has kept her alive, and she wants it to keep the player alive too. She does not say this. It is simply apparent.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Intelligence$hk$, 2, 1),
  (2, 'medium', $hk$Navigator's Tools$hk$, 2, 1),
  (3, 'light', $hk$Investigation$hk$, 1, 0)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- ARDOR — Weapons Master
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Ardor$hk$),
    $hk$The Arsenal$hk$,
    $hk$Ardor teaches broad weapon familiarisation — not mastery, but fluency. How different weapons behave, when each is the correct choice, and how to get the most out of the one that fits you. The player declares their weapon. Ardor builds everything around it.$hk$,
    $hk$+1 to attack rolls with one martial weapon of the player's choice$hk$,
    $hk$Ardor is curious about what weapon the player gravitates toward and what that says about them. He shares which weapon has saved him, which he trusted too much, which he picked up off a floor when everything else was gone. He doesn't explain why each of those stories ended the way it did.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Sleight of Hand$hk$, 2, 1),
  (2, 'heavy', $hk$Attack roll (chosen weapon)$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Ardor$hk$),
    $hk$The Puzzle$hk$,
    $hk$Ardor teaches combat as a thinking game — how to read an opponent's stance and intent before they move, and how to be already in motion when they do. Drawn from years of bounty work where going second was often not an option.$hk$,
    $hk$+1 to Initiative rolls$hk$,
    $hk$Ardor is an easy, genuinely engaged teacher. Everything about how he fights was rebuilt after something. By the second session this is quietly apparent to any player paying attention. He does not name it. He teaches the technique instead.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Insight$hk$, 1, 0),
  (2, 'medium', $hk$Perception$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Niloh Astara$hk$,
  $hk$Ardor has sparred with many students. He has never sparred with one who does not flinch. Niloh's emotional flatness — the smile that does not waver, the absence of fear or hesitation — makes him the most unsettling training partner Ardor has ever had, and also the most technically perfect. He reads opponents without the noise of his own feelings getting in the way. Ardor teaches him, and then partway through the second session goes quiet for a long moment and asks: "Are you in there?" Not cruelly. Genuinely. He has seen enough people go hollow to know the shape of it.

Additional benefit: Niloh may add his proficiency bonus to Initiative rolls in addition to his Dexterity modifier (if he does not already do so from another feature).

Ardor's closing note is not instruction. It is a question left open: "Whatever took the feeling — make sure it didn't take the person with it."$hk$
from public.trainings
where topic = $hk$The Puzzle$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Ardor$hk$);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Ardor$hk$),
    $hk$The Watch$hk$,
    $hk$Ardor teaches environmental awareness — how to read a space for threat, track multiple targets without fixing on one, and maintain awareness of what is behind you while dealing with what is in front. The skill that keeps bounty hunters alive when the job goes sideways.$hk$,
    $hk$+1 to Perception checks$hk$,
    $hk$Ardor teaches this with a particular intensity that the other trainings don't quite have. By the third session the player understands why — this is the skill he wishes he had possessed more completely on the job that went wrong. He does not say this. But the care with which he teaches it says it for him.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Perception$hk$, 2, 1),
  (2, 'light', $hk$Wisdom$hk$, 1, 0),
  (3, 'heavy', $hk$Insight$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- SHANOA BUCKLER — Lookout
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Shanoa Buckler$hk$),
    $hk$The Nest$hk$,
    $hk$Shanoa teaches observation from elevated and concealed positions — what to watch for, how to track movement patterns, and how to distinguish routine from anomaly. Imperial-trained, never fully set aside, and more useful than she would prefer to admit.$hk$,
    $hk$+1 to Perception checks$hk$,
    $hk$Shanoa teaches without small talk — she points and asks what the player sees. Near the end of the second session, when asked how she learned this, she answers plainly: "The Empire trains you to see enemies. I had to train myself to see people." She does not elaborate.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Perception$hk$, 1, 0),
  (2, 'medium', $hk$Wisdom$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Shanoa Buckler$hk$),
    $hk$The Shadow$hk$,
    $hk$Shanoa teaches movement without presence — how to cross space without being noticed, how to hold still long enough that you become part of the environment, and how to move when the moment opens. She has spent more hours in the dark and quiet than she cares to calculate.$hk$,
    $hk$+1 to Stealth checks$hk$,
    $hk$Shanoa is patient in a way that feels effortless because it is effort so thoroughly practised it no longer shows. By the second session the player begins to understand that this calm is something she built deliberately. It did not come naturally. She does not say so, but it becomes apparent.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Dexterity$hk$, 2, 1),
  (2, 'medium', $hk$Stealth$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

insert into public.training_hidden_bonuses (training_id, character_name, body)
select id, $hk$Marwyn Grayspear$hk$,
  $hk$Shanoa was trained by the Empire to move unseen and strike from darkness. Marwyn became a Gloom Stalker doing the same work for a different institution. The techniques are not identical — but the shape of them, and what they cost, are. Shanoa recognises this without being told. By the second session she teaches Marwyn something she does not teach other students: not how to be invisible, but how to be invisible to yourself — how to do the work without letting the work become who you are. She did not fully learn this. She teaches it anyway.

Additional benefit: Marwyn's Gloom Stalker Dread Ambusher feature applies on the first round of combat even when she did not initiate the encounter, provided she was not surprised.

Shanoa's closing words are quiet and without ceremony: "The Empire made us hunters. What we hunt is up to us."$hk$
from public.trainings
where topic = $hk$The Shadow$hk$
  and crew_member_id = (select id from public.crew_members where name = $hk$Shanoa Buckler$hk$);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Shanoa Buckler$hk$),
    $hk$The Shot$hk$,
    $hk$Shanoa teaches precision ranged combat — patience, breath control, distance calculation, and the specific mental state required to take a difficult shot when it matters. Built on the assumption that every shot costs something and misses have consequences.$hk$,
    $hk$+1 to attack rolls with one ranged weapon of the player's choice$hk$,
    $hk$Shanoa is exacting in a way that is clearly habitual. By the third session she admits that the technique she teaches was designed for a target she refused to take. She was discharged shortly after. She does not say whether she regrets the refusal. She does not appear to be asking for the player's opinion on it.$hk$,
    'medium', 3, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Perception$hk$, 2, 1),
  (2, 'light', $hk$Dexterity$hk$, 1, 0),
  (3, 'heavy', $hk$Attack roll (chosen ranged weapon)$hk$, 3, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

-- =====================================================================
-- ELRO BOLDFALL — Cook
-- =====================================================================
with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Elro Boldfall$hk$),
    $hk$The Creature$hk$,
    $hk$Elro teaches how to read and work with animals — not as tools, but as participants. How to approach, how to listen, when to be still and when to move. Firbolg tradition does not draw a sharp line between the lives of people and the lives of creatures. Elro teaches as though this is simply obvious.$hk$,
    $hk$+1 to Animal Handling checks$hk$,
    $hk$Elro is gentle and unhurried. The second session involves a real animal if one is available — a port bird, a ship's rat, whatever is at hand. Elro watches how the player approaches it. Whatever happens, he says something quietly encouraging. He means it.$hk$,
    'light', 2, 1, 3
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'light', $hk$Wisdom$hk$, 1, 0),
  (2, 'medium', $hk$Animal Handling$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Elro Boldfall$hk$),
    $hk$The Larder$hk$,
    $hk$Elro teaches the natural world as a resource — how to read a landscape for what it sustains, identify safe plants and dangerous ones, and understand why things grow where they do. He has foraged in deserts, swamps, jungles, and forests above the cloud layer. He has stories for all of them.$hk$,
    $hk$+1 to Nature checks$hk$,
    $hk$Elro talks about places while he teaches — each environment a memory, each memory attached to someone. The scale of the world he has moved through quietly, over 157 years, accumulates without him trying to impress anyone with it. By the second session the player has a clear sense of how long he has been watching the world.$hk$,
    'medium', 2, 1, 4
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'medium', $hk$Nature$hk$, 2, 1),
  (2, 'medium', $hk$Wisdom$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);

with t as (
  insert into public.trainings
    (crew_member_id, topic, description, reward, narrative_thread, slot_weight, sessions_required, tier_required, threshold_pp)
  values (
    (select id from public.crew_members where name = $hk$Elro Boldfall$hk$),
    $hk$The Old Words$hk$,
    $hk$Elro teaches the old ways — firbolg tradition around the dead, divine naming across cultures, and what different peoples have believed waits on the other side of a life. He does not proselytise. He teaches this the way he teaches everything: as something worth knowing, shared with someone he trusts to hold it carefully.$hk$,
    $hk$+1 to Religion checks$hk$,
    $hk$Elro teaches this sitting down, usually in the kitchen, usually with something on the stove. It is not a lesson so much as a conversation he steers. By the end of the second session the player has heard more about what Elro believes — about life, death, and what persists — than anyone else on the ship has. He chose to share this. That choice was not incidental.$hk$,
    'heavy', 2, 1, 5
  ) returning id
)
insert into public.training_sessions (training_id, session_number, length, roll_type, pp_success, pp_fail)
select t.id, v.session_number, v.length, v.roll_type, v.pp_success, v.pp_fail
from t, (values
  (1, 'heavy', $hk$Wisdom$hk$, 3, 1),
  (2, 'medium', $hk$Religion$hk$, 2, 1)
) as v(session_number, length, roll_type, pp_success, pp_fail);
