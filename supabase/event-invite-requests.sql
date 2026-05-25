-- GOODFRIENDS — Event invite requests
-- Apply this in Supabase SQL editor before enabling the event sharing UI in production.

create table if not exists public.event_invite_requests (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade not null,
  requester_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending','approved','rejected')) not null,
  decided_by uuid references public.profiles(id),
  decided_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(plan_id, requester_id)
);

alter table public.event_invite_requests enable row level security;

drop policy if exists "event_invite_requests_select" on public.event_invite_requests;
drop policy if exists "event_invite_requests_insert" on public.event_invite_requests;
drop policy if exists "event_invite_requests_update" on public.event_invite_requests;
drop policy if exists "event_invite_requests_delete" on public.event_invite_requests;

create policy "event_invite_requests_select" on public.event_invite_requests for select using (
  requester_id = auth.uid()
  or exists (
    select 1 from public.plans p
    where p.id = event_invite_requests.plan_id
      and p.organiser_id = auth.uid()
  )
);

create policy "event_invite_requests_insert" on public.event_invite_requests for insert with check (
  requester_id = auth.uid()
  and exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = event_invite_requests.plan_id
      and gm.user_id = auth.uid()
      and p.organiser_id <> auth.uid()
  )
  and not exists (
    select 1 from public.rsvps r
    where r.plan_id = event_invite_requests.plan_id
      and r.user_id = auth.uid()
  )
);

create policy "event_invite_requests_update" on public.event_invite_requests for update using (
  exists (
    select 1 from public.plans p
    where p.id = event_invite_requests.plan_id
      and p.organiser_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.plans p
    where p.id = event_invite_requests.plan_id
      and p.organiser_id = auth.uid()
  )
);

create policy "event_invite_requests_delete" on public.event_invite_requests for delete using (
  requester_id = auth.uid() and status = 'pending'
);

create index if not exists event_invite_requests_plan_id_idx on public.event_invite_requests(plan_id);
create index if not exists event_invite_requests_requester_id_idx on public.event_invite_requests(requester_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'event_invite',
  'event_rsvp',
  'event_comment',
  'event_closed',
  'event_cancelled',
  'event_reminder',
  'event_filling',
  'no_reply_nudge',
  'photo_posted',
  'reaction_received',
  'event_invite_request',
  'event_request_approved',
  'event_request_rejected'
));

do $$
begin
  alter publication supabase_realtime add table public.event_invite_requests;
exception
  when duplicate_object then null;
end $$;
