-- xleaf schema. Paste this whole file into Supabase → SQL Editor → Run.
-- Every row belongs to the signed-in user; row-level security makes sure
-- nobody can read or write anyone else's notebooks.

create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null default 'ink',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default 'manila',
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  topic_id uuid references public.topics (id) on delete set null,
  content text not null check (char_length(content) between 1 and 4000),
  original text check (original is null or char_length(original) <= 4000),
  kind text not null default 'fact' check (kind in ('fact', 'definition', 'exam', 'todo', 'question', 'formula')),
  pinned boolean not null default false,
  sorted_by text check (sorted_by in ('you', 'auto', 'ai')),
  review text check (review in ('pending', 'done')),
  flag text check (flag is null or char_length(flag) <= 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notebooks_user_idx on public.notebooks (user_id);
create index if not exists topics_user_idx on public.topics (user_id);
create index if not exists topics_notebook_idx on public.topics (notebook_id);
create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists notes_notebook_idx on public.notes (notebook_id);
create index if not exists notes_topic_idx on public.notes (topic_id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notebooks_touch on public.notebooks;
create trigger notebooks_touch before update on public.notebooks
  for each row execute function public.touch_updated_at();

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

-- Row-level security: you only ever see and change your own rows, and topics
-- and notes can only point at notebooks you own.
alter table public.notebooks enable row level security;
alter table public.topics enable row level security;
alter table public.notes enable row level security;

drop policy if exists "own notebooks" on public.notebooks;
create policy "own notebooks" on public.notebooks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "own topics" on public.topics;
create policy "own topics" on public.topics
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = (select auth.uid()))
  );

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notebooks n where n.id = notebook_id and n.user_id = (select auth.uid()))
    and (topic_id is null or exists (select 1 from public.topics t where t.id = topic_id and t.user_id = (select auth.uid())))
  );

-- Newer Supabase projects don't expose new tables to the API automatically.
grant select, insert, update, delete on public.notebooks, public.topics, public.notes to authenticated;
