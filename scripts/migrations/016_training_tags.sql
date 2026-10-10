-- Training tags.
--
-- Each training carries a set of tags — combat, magic, skills, social, tools —
-- that players filter the catalog and the training picker by. The DM edits
-- them in the Trainings tab; this seeds the initial curriculum.
--
--   combat  weapon attacks and initiative
--   magic   arcane study and resisting magic
--   skills  +1 to a skill check
--   social  reading and moving people
--   tools   tool and kit proficiencies
--
-- Run in the Supabase SQL editor.

alter table public.trainings
  add column if not exists tags text[] not null default '{}';

alter table public.trainings
  drop constraint if exists trainings_tags_check;
alter table public.trainings
  add constraint trainings_tags_check
  check (tags <@ array['combat', 'magic', 'skills', 'social', 'tools']::text[]);

update public.trainings t
set tags = v.tags
from (values
  ($hk$Anna Rose$hk$,      $hk$The Hand$hk$,              array['skills']),
  ($hk$Anna Rose$hk$,      $hk$The Blade$hk$,             array['combat']),
  ($hk$Anna Rose$hk$,      $hk$The Mark$hk$,              array['skills', 'social']),
  ($hk$Rachel Rose$hk$,    $hk$The Body Remembers$hk$,    array['skills']),
  ($hk$Rachel Rose$hk$,    $hk$The Living Current$hk$,    array['magic', 'skills']),
  ($hk$Rachel Rose$hk$,    $hk$The Kit$hk$,               array['tools']),
  ($hk$Guner Aldric$hk$,   $hk$The Line$hk$,              array['combat']),
  ($hk$Guner Aldric$hk$,   $hk$The Hold$hk$,              array['skills']),
  ($hk$Guner Aldric$hk$,   $hk$The Address$hk$,           array['skills', 'social']),
  ($hk$Bryce Morrison$hk$, $hk$The Performance$hk$,       array['skills', 'social']),
  ($hk$Bryce Morrison$hk$, $hk$The Surge$hk$,             array['magic']),
  ($hk$Bryce Morrison$hk$, $hk$The Wood$hk$,              array['tools']),
  ($hk$Delvin Moss$hk$,    $hk$The Deck$hk$,              array['tools']),
  ($hk$Delvin Moss$hk$,    $hk$The Long Memory$hk$,       array['skills']),
  ($hk$Delvin Moss$hk$,    $hk$The Story$hk$,             array['skills', 'social']),
  ($hk$Porter Tomas$hk$,   $hk$The Step$hk$,              array['skills']),
  ($hk$Porter Tomas$hk$,   $hk$The Threat$hk$,            array['skills', 'social']),
  ($hk$Porter Tomas$hk$,   $hk$The Dirty Way$hk$,         array['combat']),
  ($hk$Toji Brassboot$hk$, $hk$The System$hk$,            array['skills']),
  ($hk$Toji Brassboot$hk$, $hk$The Current$hk$,           array['magic', 'skills']),
  ($hk$Toji Brassboot$hk$, $hk$The Tools$hk$,             array['tools']),
  ($hk$Lehiri Stars$hk$,   $hk$The Chart and the Sky$hk$, array['skills']),
  ($hk$Lehiri Stars$hk$,   $hk$The Watch$hk$,             array['skills']),
  ($hk$Lehiri Stars$hk$,   $hk$The Instrument$hk$,        array['tools']),
  ($hk$Ardor$hk$,          $hk$The Arsenal$hk$,           array['combat']),
  ($hk$Ardor$hk$,          $hk$The Puzzle$hk$,            array['combat']),
  ($hk$Ardor$hk$,          $hk$The Watch$hk$,             array['skills']),
  ($hk$Shanoa Buckler$hk$, $hk$The Nest$hk$,              array['skills']),
  ($hk$Shanoa Buckler$hk$, $hk$The Shadow$hk$,            array['skills']),
  ($hk$Shanoa Buckler$hk$, $hk$The Shot$hk$,              array['combat']),
  ($hk$Elro Boldfall$hk$,  $hk$The Creature$hk$,          array['skills']),
  ($hk$Elro Boldfall$hk$,  $hk$The Larder$hk$,            array['skills']),
  ($hk$Elro Boldfall$hk$,  $hk$The Old Words$hk$,         array['skills'])
) as v(crew, topic, tags)
where t.topic = v.topic
  and t.crew_member_id = (select id from public.crew_members c where c.name = v.crew);
