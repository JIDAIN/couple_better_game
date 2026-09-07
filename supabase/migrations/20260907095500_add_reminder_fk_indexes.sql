-- Cover reminder-center foreign keys reported by Supabase advisor.
create index if not exists life_reminder_instances_rule_id_idx
  on public.life_reminder_instances(rule_id)
  where rule_id is not null;

create index if not exists life_reminder_rules_space_creator_idx
  on public.life_reminder_rules(couple_space_id, created_by);
