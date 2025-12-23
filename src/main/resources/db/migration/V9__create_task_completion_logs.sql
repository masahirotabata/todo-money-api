create table if not exists task_completion_logs (
  id bigserial primary key,
  task_id bigint not null references tasks(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  completed_at timestamptz not null default now()
);

create index if not exists idx_task_completion_logs_task_id on task_completion_logs(task_id);
create index if not exists idx_task_completion_logs_user_id on task_completion_logs(user_id);
create index if not exists idx_task_completion_logs_completed_at on task_completion_logs(completed_at);
