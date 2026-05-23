-- ============================================
-- GOODFRIENDS — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  emoji text default '😎',
  email text,
  created_at timestamp with time zone default now()
);
alter table public.profiles enable row level security;
create policy "Users can view all profiles" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Groups
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_by uuid references public.profiles(id),
  invite_code text unique default substr(md5(random()::text), 1, 8),
  emoji text default '🎉',
  member_emojis text[] default '{}',
  created_at timestamp with time zone default now()
);
alter table public.groups enable row level security;

-- Group members
create table public.group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(group_id, user_id)
);
alter table public.group_members enable row level security;

-- Membership check helper. SECURITY DEFINER so the inner read of
-- group_members bypasses RLS — without this, any policy that needs to
-- ask "is the caller a member of group X?" recurses infinitely because
-- the subquery re-triggers the same group_members SELECT policy.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;
grant execute on function public.is_group_member(uuid) to anon, authenticated;

create policy "Group members can view groups" on public.groups for select using (
  public.is_group_member(id)
);
create policy "Users can create groups" on public.groups for insert with check (auth.uid() = created_by);
create policy "Creator can update group" on public.groups for update using (auth.uid() = created_by);

create policy "Members can view group members" on public.group_members for select using (
  user_id = auth.uid() or public.is_group_member(group_id)
);
create policy "Users can join groups" on public.group_members for insert with check (auth.uid() = user_id);

-- Plans
create table public.plans (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references public.groups(id) on delete cascade,
  organiser_id uuid references public.profiles(id),
  name text not null,
  date date,
  time text,
  location text,
  notes text,
  tier integer default 3 check (tier in (1,2,3)),
  status text default 'open' check (status in ('open','closed','cancelled')),
  created_at timestamp with time zone default now()
);
alter table public.plans enable row level security;
create policy "Group members can view plans" on public.plans for select using (
  exists (select 1 from public.group_members where group_id = plans.group_id and user_id = auth.uid())
);
create policy "Group members can create plans" on public.plans for insert with check (
  exists (select 1 from public.group_members where group_id = plans.group_id and user_id = auth.uid())
);
create policy "Organiser can update plan" on public.plans for update using (auth.uid() = organiser_id);
create policy "plans_delete" on public.plans for delete using (auth.uid() = organiser_id);

-- RSVPs
create table public.rsvps (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text check (status in ('in','likely','no')),
  updated_at timestamp with time zone default now(),
  unique(plan_id, user_id)
);
alter table public.rsvps enable row level security;
create policy "Group members can view rsvps" on public.rsvps for select using (
  exists (
    select 1 from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = rsvps.plan_id and gm.user_id = auth.uid()
  )
);
create policy "Users can upsert own rsvp" on public.rsvps for insert with check (auth.uid() = user_id);
-- An organiser inviting members creates RSVP rows on their behalf with
-- status=null so the plan shows up in those members' feeds. Without this
-- second INSERT policy the batch insert in CreatePlan would fail RLS for
-- every row that isn't auth.uid()'s own.
create policy "Organiser can invite members" on public.rsvps for insert with check (
  exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = rsvps.plan_id
      and p.organiser_id = auth.uid()
      and gm.user_id = rsvps.user_id
  )
);
create policy "Users can update own rsvp" on public.rsvps for update using (auth.uid() = user_id);
create policy "Users can delete own rsvp" on public.rsvps for delete using (auth.uid() = user_id);
-- Organiser editing the plan can prune the guest list.
create policy "Organiser can remove invites" on public.rsvps for delete using (
  exists (
    select 1 from public.plans p
    where p.id = rsvps.plan_id and p.organiser_id = auth.uid()
  )
);

-- Attendances (recorded when plan is closed)
create table public.attendances (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  came boolean default false,
  created_at timestamp with time zone default now(),
  unique(plan_id, user_id)
);
alter table public.attendances enable row level security;
create policy "Group members can view attendances" on public.attendances for select using (
  exists (
    select 1 from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = attendances.plan_id and gm.user_id = auth.uid()
  )
);
create policy "Organiser can record attendance" on public.attendances for insert with check (
  exists (select 1 from public.plans where id = attendances.plan_id and organiser_id = auth.uid())
);
create policy "Organiser can update attendance" on public.attendances for update using (
  exists (select 1 from public.plans where id = attendances.plan_id and organiser_id = auth.uid())
);
create policy "attendances_delete" on public.attendances for delete using (
  exists (select 1 from public.plans where id = attendances.plan_id and organiser_id = auth.uid())
);

-- Member scores (updated on plan close)
create table public.member_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  score integer default 0,
  plans_organised integer default 0,
  attendance_rate integer default 0,
  grace_passes_remaining integer default 2,
  streak boolean[] default '{}',
  updated_at timestamp with time zone default now(),
  unique(user_id, group_id)
);
alter table public.member_scores enable row level security;
create policy "Group members can view scores" on public.member_scores for select using (
  exists (select 1 from public.group_members where group_id = member_scores.group_id and user_id = auth.uid())
);
create policy "System can update scores" on public.member_scores for all using (true);

-- Add points function (called after plan close)
create or replace function public.add_points(p_user_id uuid, p_group_id uuid, p_points integer)
returns void as $$
begin
  insert into public.member_scores (user_id, group_id, score)
  values (p_user_id, p_group_id, p_points)
  on conflict (user_id, group_id)
  do update set score = member_scores.score + p_points, updated_at = now();
end;
$$ language plpgsql security definer;

-- Recalculate attendance rate / plans organised / streak (call after closing a plan)
create or replace function public.recalculate_member_score(p_user_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_attended integer;
  v_rate integer;
  v_organised integer;
  v_streak boolean[];
begin
  select count(*), count(*) filter (where a.came = true)
  into v_total, v_attended
  from public.attendances a
  join public.plans p on p.id = a.plan_id
  where a.user_id = p_user_id and p.group_id = p_group_id and p.status = 'closed';

  v_rate := case when v_total > 0 then round(v_attended * 100.0 / v_total) else 0 end;

  select count(*) into v_organised
  from public.plans
  where organiser_id = p_user_id and group_id = p_group_id and status = 'closed';

  with recent as (
    select a.came, p.date
    from public.attendances a
    join public.plans p on p.id = a.plan_id
    where a.user_id = p_user_id and p.group_id = p_group_id and p.status = 'closed'
    order by p.date desc
    limit 7
  )
  select coalesce(array_agg(came order by date desc), array[]::boolean[])
  into v_streak from recent;

  insert into public.member_scores (user_id, group_id, attendance_rate, plans_organised, streak)
  values (p_user_id, p_group_id, v_rate, v_organised, v_streak)
  on conflict (user_id, group_id)
  do update set
    attendance_rate = excluded.attendance_rate,
    plans_organised = excluded.plans_organised,
    streak = excluded.streak,
    updated_at = now();
end;
$$;

grant execute on function public.recalculate_member_score(uuid, uuid) to authenticated;

-- Join a group via invite code (security definer so brand-new members
-- can bypass the "must already be a member" SELECT policy on groups)
create or replace function public.join_group_by_invite(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  select * into v_group from public.groups where invite_code = p_invite_code;
  if v_group.id is null then
    raise exception 'invalid_invite_code' using errcode = 'P0001';
  end if;
  insert into public.group_members (group_id, user_id)
  values (v_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;
  return v_group;
end;
$$;

grant execute on function public.join_group_by_invite(text) to authenticated;

-- Any member of a group can change its emoji. SECURITY DEFINER so we can
-- enforce membership without giving members blanket UPDATE on groups
-- (the "Creator can update group" policy still gates name and everything else).
create or replace function public.set_group_emoji(p_group_id uuid, p_emoji text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_emoji is null or length(p_emoji) = 0 or length(p_emoji) > 32 then
    raise exception 'invalid_emoji' using errcode = 'P0001';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  update public.groups set emoji = p_emoji where id = p_group_id;
end;
$$;

grant execute on function public.set_group_emoji(uuid, text) to authenticated;

-- Public preview of a group by invite code (no auth required).
-- Returns a redacted JSON payload safe for unauthenticated callers — only
-- aggregate stats and emojis, never raw user identifiers or contact info.
create or replace function public.get_invite_preview(p_invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
  v_organiser_emoji text;
  v_member_count int;
  v_member_emojis text[];
  v_avg_rate int;
  v_next_plan jsonb;
begin
  select * into v_group from public.groups where invite_code = p_invite_code;
  if v_group.id is null then return null; end if;

  select emoji into v_organiser_emoji
  from public.profiles where id = v_group.created_by;

  select count(*)::int, coalesce(array_agg(p.emoji order by gm.joined_at), array[]::text[])
    into v_member_count, v_member_emojis
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = v_group.id;

  select coalesce(round(avg(attendance_rate))::int, 0) into v_avg_rate
  from public.member_scores
  where group_id = v_group.id;

  select to_jsonb(np) into v_next_plan
  from (
    select name, date, time, location
    from public.plans
    where group_id = v_group.id
      and status = 'open'
      and (date is null or date >= current_date)
    order by date asc nulls last
    limit 1
  ) np;

  return jsonb_build_object(
    'name', v_group.name,
    'invite_code', v_group.invite_code,
    'organiser_emoji', v_organiser_emoji,
    'member_count', coalesce(v_member_count, 0),
    'member_emojis', coalesce(v_member_emojis, array[]::text[]),
    'avg_attendance', coalesce(v_avg_rate, 0),
    'next_plan', v_next_plan
  );
end;
$$;

grant execute on function public.get_invite_preview(text) to anon, authenticated;

-- Moments feed: posts (photos + comments) and reactions
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references public.plans(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  type text check (type in ('photo','comment')) not null,
  content text,
  caption text,    -- Optional caption when type='photo'; null for comments
  image_url text,
  created_at timestamp with time zone default now()
);
alter table public.posts enable row level security;
create policy "posts_select" on public.posts for select using (
  exists (
    select 1 from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = posts.plan_id and gm.user_id = auth.uid()
  )
);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update" on public.posts for update using (auth.uid() = user_id);
create policy "posts_delete" on public.posts for delete using (auth.uid() = user_id);

create table public.reactions (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamp with time zone default now(),
  unique(post_id, user_id)
);
alter table public.reactions enable row level security;
create policy "reactions_select" on public.reactions for select using (true);
create policy "reactions_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on public.reactions for delete using (auth.uid() = user_id);

-- Storage bucket + policies for photo posts
insert into storage.buckets (id, name, public) values ('plan-photos', 'plan-photos', true)
  on conflict (id) do nothing;
create policy "Anyone can view photos" on storage.objects for select using (bucket_id = 'plan-photos');
create policy "Auth users can upload" on storage.objects for insert with check (
  bucket_id = 'plan-photos' and auth.role() = 'authenticated'
);
create policy "Users can delete own photos" on storage.objects for delete using (
  bucket_id = 'plan-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable realtime on rsvps and plans
alter publication supabase_realtime add table public.rsvps;
alter publication supabase_realtime add table public.plans;
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.reactions;
