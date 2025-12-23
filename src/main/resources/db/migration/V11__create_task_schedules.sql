CREATE TABLE IF NOT EXISTS todomoney.task_schedules (
  id BIGSERIAL PRIMARY KEY,

  -- task に紐づく想定（あなたの設計に合わせて）
  task_id BIGINT NOT NULL,

  -- 例：毎日/毎週/単発など（Entityに合わせて調整）
  schedule_type VARCHAR(30) NOT NULL,

  -- 例：次回実行日や発生日（Entityに occurrenceDate/nextRunAt 等があるなら合わせる）
  occurrence_date DATE,

  -- 監査系（Entityに createdAt/updatedAt があるなら合わせる）
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 外部キー（tasks テーブル名/スキーマが違うなら修正）
ALTER TABLE todomoney.task_schedules
  ADD CONSTRAINT fk_task_schedules_task
  FOREIGN KEY (task_id)
  REFERENCES todomoney.tasks(id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_task_schedules_task_id
  ON todomoney.task_schedules(task_id);
