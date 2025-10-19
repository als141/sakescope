-- Sakescope Gift Feature Database Schema
-- This schema supports the gift feature where senders can create gift links
-- Recipients use one-time URLs to have casual conversations about sake preferences
-- The system recommends sake only to the sender, not to the recipient

-- Gifts table: Stores gift information created by senders
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_user_id text not null,              -- Clerk user id
  recipient_first_name text,                  -- Optional, minimal info (e.g., "お父さん")
  occasion text,                              -- E.g., "父の日", "誕生日"
  budget_min int not null check (budget_min > 0),
  budget_max int not null check (budget_max >= budget_min),
  message_to_recipient text,                  -- Optional message (minimized)
  status text not null default 'LINK_CREATED' check (status in (
    'DRAFT',
    'LINK_CREATED',
    'OPENED',
    'INTAKE_STARTED',
    'INTAKE_COMPLETED',
    'HANDOFFED',
    'RECOMMEND_READY',
    'NOTIFIED',
    'CLOSED',
    'EXPIRED'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for sender queries
create index idx_gifts_sender_user_id on public.gifts(sender_user_id);
create index idx_gifts_status on public.gifts(status);

-- Gift tokens: One-time access tokens for recipients (anonymous access)
create table public.gift_tokens (
  gift_id uuid not null references public.gifts(id) on delete cascade,
  token_hash text not null,                   -- SHA-256 hash of token
  expires_at timestamptz not null,
  consumed_at timestamptz,
  primary key (gift_id, token_hash)
);

-- Index for token verification
create index idx_gift_tokens_hash on public.gift_tokens(token_hash);
create index idx_gift_tokens_expires on public.gift_tokens(expires_at);

-- Gift sessions: Recipient's conversation session (one per gift)
create table public.gift_sessions (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  agent_trace_id text,                        -- Trace ID for debugging
  intake_summary jsonb,                       -- Extracted preferences (dry/sweet, aroma, temperature, food pairing)
  age_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for gift session lookup
create index idx_gift_sessions_gift_id on public.gift_sessions(gift_id);

-- Gift messages: Conversation log (minimal, anonymized)
create table public.gift_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.gift_sessions(id) on delete cascade,
  role text not null check (role in ('system', 'assistant', 'user')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Index for message retrieval
create index idx_gift_messages_session_id on public.gift_messages(session_id);

-- Gift recommendations: Text agent results
create table public.gift_recommendations (
  gift_id uuid primary key references public.gifts(id) on delete cascade,
  recommendations jsonb not null,             -- Sake list, reasoning, purchase links
  model text,
  created_at timestamptz not null default now()
);

-- Notifications: Queue for sender notifications
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id text not null,                      -- Clerk user id
  type text not null,                         -- E.g., 'gift_recommend_ready'
  payload jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Index for notification queries
create index idx_notifications_user_id on public.notifications(user_id, read_at);
create index idx_notifications_created_at on public.notifications(created_at desc);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
alter table public.gifts enable row level security;
alter table public.gift_tokens enable row level security;
alter table public.gift_sessions enable row level security;
alter table public.gift_messages enable row level security;
alter table public.gift_recommendations enable row level security;
alter table public.notifications enable row level security;

-- Gifts: Sender can read/update their own gifts
create policy "Senders can read own gifts"
  on public.gifts for select
  using (auth.uid()::text = sender_user_id);

create policy "Senders can insert own gifts"
  on public.gifts for insert
  with check (auth.uid()::text = sender_user_id);

create policy "Senders can update own gifts"
  on public.gifts for update
  using (auth.uid()::text = sender_user_id);

-- Gift tokens: No direct client access (server-only)
-- Tokens are verified server-side only

-- Gift sessions: No direct client access (server-side API only)

-- Gift messages: No direct client access (server-side API only)

-- Gift recommendations: Sender can read recommendations for their gifts
create policy "Senders can read own gift recommendations"
  on public.gift_recommendations for select
  using (
    exists (
      select 1 from public.gifts
      where gifts.id = gift_recommendations.gift_id
      and gifts.sender_user_id = auth.uid()::text
    )
  );

-- Notifications: User can read their own notifications
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid()::text = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid()::text = user_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger to auto-update updated_at
create trigger update_gifts_updated_at
  before update on public.gifts
  for each row
  execute function update_updated_at_column();

-- Service role policies for server-side operations
-- These allow the service role to bypass RLS for gift token validation and session management

-- Grant service role access to all tables
grant all on public.gifts to service_role;
grant all on public.gift_tokens to service_role;
grant all on public.gift_sessions to service_role;
grant all on public.gift_messages to service_role;
grant all on public.gift_recommendations to service_role;
grant all on public.notifications to service_role;

-- Comments for documentation
comment on table public.gifts is 'Stores gift information created by authenticated senders';
comment on table public.gift_tokens is 'One-time access tokens for anonymous recipients (hash stored)';
comment on table public.gift_sessions is 'Recipient conversation sessions for preference collection';
comment on table public.gift_messages is 'Minimal conversation logs (anonymized)';
comment on table public.gift_recommendations is 'Text agent results sent only to senders';
comment on table public.notifications is 'Notification queue for sender updates';
