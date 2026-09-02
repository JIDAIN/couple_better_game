alter table public.mood_entries
  drop constraint if exists mood_entries_mood_key_check;

alter table public.mood_entries
  add constraint mood_entries_mood_key_check
  check (mood_key in ('happy','calm','neutral','anxious','sad','angry','tired','excited'));
