-- Full Alysion card pool (alysion.gg game data merged with the official list).
-- Written only by the import GitHub Action (service role); the app reads it with the anon key.
create table if not exists public.cards (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cards enable row level security;

drop policy if exists "cards are readable" on public.cards;
create policy "cards are readable" on public.cards for select to anon, authenticated using (true);
