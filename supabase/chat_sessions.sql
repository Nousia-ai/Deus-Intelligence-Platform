-- ─────────────────────────────────────────────────────────────────────────────
-- Chat persistence tables — run once in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists chat_sessions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  error      boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_created
  on chat_messages(session_id, created_at asc);
