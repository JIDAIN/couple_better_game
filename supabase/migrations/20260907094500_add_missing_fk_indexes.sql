-- Cover foreign keys reported by Supabase advisor. These are additive and do not change access semantics.
create index if not exists exchange_records_category_id_idx
  on public.exchange_records(category_id);

create index if not exists mailbox_letters_space_recipient_idx
  on public.mailbox_letters(couple_space_id, recipient_key);

create index if not exists mailbox_letters_space_sender_idx
  on public.mailbox_letters(couple_space_id, sender_key);

create index if not exists partner_profiles_auth_user_id_idx
  on public.partner_profiles(auth_user_id)
  where auth_user_id is not null;
