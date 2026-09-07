-- Mailbox V2: drafts are private to the sender; sent items are immutable shared messages.
-- Existing rows are preserved as sent messages. Legacy RPCs remain available until
-- the matching web/MCP code is deployed, while the new actor-aware RPCs enforce
-- the final permission model.

alter table public.mailbox_letters
  add column if not exists status text not null default 'sent'
  check (status in ('draft','sent'));

alter table public.mailbox_letters
  alter column sent_at drop not null;

update public.mailbox_letters
set sent_at = coalesce(sent_at, created_at)
where status = 'sent' and sent_at is null;

create index if not exists mailbox_letters_space_sender_status_idx
  on public.mailbox_letters(couple_space_id, sender_key, status, updated_at desc)
  where deleted_at is null;

create index if not exists mailbox_letters_space_recipient_sent_idx
  on public.mailbox_letters(couple_space_id, recipient_key, sent_at desc)
  where deleted_at is null and status = 'sent';

create or replace function private.mailbox_letter_json(p_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select jsonb_build_object(
    'id', m.id,
    'senderKey', m.sender_key,
    'recipientKey', m.recipient_key,
    'format', m.format,
    'title', m.title,
    'themeKey', m.theme_key,
    'body', m.body,
    'status', m.status,
    'sentAt', m.sent_at,
    'source', m.source,
    'createdAt', m.created_at,
    'updatedAt', m.updated_at
  )
  from public.mailbox_letters m
  where m.id = p_id and m.deleted_at is null;
$$;

-- Keep the legacy listing sent-only so pre-deployment clients never see a draft.
create or replace function public.list_mailbox_letters(
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language sql
stable
security invoker
set search_path = public, private
as $$
  select coalesce(
    jsonb_agg(private.mailbox_letter_json(m.id) order by m.sent_at desc, m.created_at desc),
    '[]'::jsonb
  )
  from public.mailbox_letters m
  join public.couple_spaces cs on cs.id = m.couple_space_id
  where cs.slug = p_space_slug
    and cs.archived_at is null
    and m.deleted_at is null
    and m.status = 'sent';
$$;

create or replace function public.list_mailbox_items_authorized(
  p_actor text,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid mailbox actor'; end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  if not exists (
    select 1 from public.partner_profiles
    where couple_space_id = v_space_id and partner_key = p_actor
  ) then raise exception 'Partner profile not found'; end if;

  return coalesce((
    select jsonb_agg(
      private.mailbox_letter_json(m.id)
      order by coalesce(m.sent_at, m.updated_at) desc, m.created_at desc, m.id
    )
    from public.mailbox_letters m
    where m.couple_space_id = v_space_id
      and m.deleted_at is null
      and (
        (m.status = 'draft' and m.sender_key = p_actor)
        or
        (m.status = 'sent' and (m.sender_key = p_actor or m.recipient_key = p_actor))
      )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_mailbox_item_authorized(
  p_actor text,
  p_payload jsonb,
  p_status text default 'draft',
  p_source text default 'manual',
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_id uuid;
  v_recipient text;
  v_format text := coalesce(nullif(p_payload->>'format',''), 'letter');
  v_body text := btrim(coalesce(p_payload->>'body',''));
  v_title text := nullif(btrim(p_payload->>'title'), '');
  v_theme text := coalesce(nullif(btrim(p_payload->>'themeKey'), ''), 'cream');
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid mailbox actor'; end if;
  if p_status not in ('draft','sent') then raise exception 'Invalid mailbox status'; end if;
  if p_source not in ('manual','chatgpt','import') then raise exception 'Invalid mailbox source'; end if;
  if v_format not in ('letter','postcard') then raise exception 'Invalid mailbox format'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'Mailbox body is required and must be at most 2000 characters'; end if;
  if v_title is not null and char_length(v_title) > 120 then raise exception 'Mailbox title is too long'; end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  v_recipient := case when p_actor = 'cat' then 'fish' else 'cat' end;

  insert into public.mailbox_letters(
    couple_space_id,
    sender_key,
    recipient_key,
    format,
    title,
    theme_key,
    body,
    status,
    sent_at,
    source
  ) values (
    v_space_id,
    p_actor,
    v_recipient,
    v_format,
    case when v_format = 'letter' then v_title else null end,
    v_theme,
    v_body,
    p_status,
    case when p_status = 'sent' then now() else null end,
    p_source
  ) returning id into v_id;

  return private.mailbox_letter_json(v_id);
end;
$$;

create or replace function public.update_mailbox_draft_authorized(
  p_actor text,
  p_letter_id uuid,
  p_payload jsonb,
  p_source text default 'manual',
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_format text := coalesce(nullif(p_payload->>'format',''), 'letter');
  v_body text := btrim(coalesce(p_payload->>'body',''));
  v_title text := nullif(btrim(p_payload->>'title'), '');
  v_theme text := coalesce(nullif(btrim(p_payload->>'themeKey'), ''), 'cream');
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid mailbox actor'; end if;
  if p_source not in ('manual','chatgpt','import') then raise exception 'Invalid mailbox source'; end if;
  if v_format not in ('letter','postcard') then raise exception 'Invalid mailbox format'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then raise exception 'Mailbox body is required and must be at most 2000 characters'; end if;
  if v_title is not null and char_length(v_title) > 120 then raise exception 'Mailbox title is too long'; end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  update public.mailbox_letters
  set format = v_format,
      title = case when v_format = 'letter' then v_title else null end,
      theme_key = v_theme,
      body = v_body,
      source = p_source,
      updated_at = now()
  where id = p_letter_id
    and couple_space_id = v_space_id
    and sender_key = p_actor
    and status = 'draft'
    and deleted_at is null;

  if not found then raise exception 'Mailbox draft not found or immutable'; end if;
  return private.mailbox_letter_json(p_letter_id);
end;
$$;

create or replace function public.send_mailbox_draft_authorized(
  p_actor text,
  p_letter_id uuid,
  p_source text default 'manual',
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid mailbox actor'; end if;
  if p_source not in ('manual','chatgpt','import') then raise exception 'Invalid mailbox source'; end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  update public.mailbox_letters
  set status = 'sent',
      sent_at = now(),
      source = p_source,
      updated_at = now()
  where id = p_letter_id
    and couple_space_id = v_space_id
    and sender_key = p_actor
    and status = 'draft'
    and deleted_at is null;

  if not found then raise exception 'Mailbox draft not found or already sent'; end if;
  return private.mailbox_letter_json(p_letter_id);
end;
$$;

create or replace function public.delete_mailbox_draft_authorized(
  p_actor text,
  p_letter_id uuid,
  p_space_slug text default 'couple-better-game'
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private
as $$
declare
  v_space_id uuid;
  v_record jsonb;
begin
  if p_actor not in ('cat','fish') then raise exception 'Invalid mailbox actor'; end if;

  select id into v_space_id
  from public.couple_spaces
  where slug = p_space_slug and archived_at is null;
  if v_space_id is null then raise exception 'Couple space not found'; end if;

  select private.mailbox_letter_json(m.id) into v_record
  from public.mailbox_letters m
  where m.id = p_letter_id
    and m.couple_space_id = v_space_id
    and m.sender_key = p_actor
    and m.status = 'draft'
    and m.deleted_at is null;

  if v_record is null then raise exception 'Mailbox draft not found or immutable'; end if;

  update public.mailbox_letters
  set deleted_at = now(), updated_at = now()
  where id = p_letter_id
    and couple_space_id = v_space_id
    and sender_key = p_actor
    and status = 'draft'
    and deleted_at is null;

  return v_record;
end;
$$;

revoke all on function public.list_mailbox_items_authorized(text, text) from public, anon, authenticated;
revoke all on function public.create_mailbox_item_authorized(text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.update_mailbox_draft_authorized(text, uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.send_mailbox_draft_authorized(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.delete_mailbox_draft_authorized(text, uuid, text) from public, anon, authenticated;

grant execute on function public.list_mailbox_items_authorized(text, text) to service_role;
grant execute on function public.create_mailbox_item_authorized(text, jsonb, text, text, text) to service_role;
grant execute on function public.update_mailbox_draft_authorized(text, uuid, jsonb, text, text) to service_role;
grant execute on function public.send_mailbox_draft_authorized(text, uuid, text, text) to service_role;
grant execute on function public.delete_mailbox_draft_authorized(text, uuid, text) to service_role;