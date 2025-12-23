-- schema を todomoney にしているなら、念のため schema を明示
ALTER TABLE todomoney.task_schedules
  ADD COLUMN IF NOT EXISTS dow_mask INTEGER NOT NULL DEFAULT 0;
