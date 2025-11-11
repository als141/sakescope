-- Add background job tables for gift recommendations
create table if not exists public.gift_jobs (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts(id) on delete cascade,
  response_id text not null,
  run_id text,
  status text not null default 'QUEUED' check (status in (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
  )),
  metadata jsonb,
  handoff_summary text,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  timeout_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gift_jobs_gift_id on public.gift_jobs(gift_id);
create index if not exists idx_gift_jobs_status on public.gift_jobs(status);

create table if not exists public.gift_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.gift_jobs(id) on delete cascade,
  event_type text not null,
  label text,
  message text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_gift_job_events_job_id_created_at
  on public.gift_job_events(job_id, created_at);

alter table public.gift_jobs enable row level security;
alter table public.gift_job_events enable row level security;

grant all on public.gift_jobs to service_role;
grant all on public.gift_job_events to service_role;

comment on table public.gift_jobs is 'Background OpenAI Responses jobs triggered after intake completion';
comment on table public.gift_job_events is 'Append-only status timeline for monitoring gift jobs';
