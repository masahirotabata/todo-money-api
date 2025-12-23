-- task_tags テーブルを作成
CREATE TABLE IF NOT EXISTS task_tags (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL,
  tag VARCHAR(50) NOT NULL
);

-- task_id へのFK（tasks(id) がある前提）
ALTER TABLE task_tags
  DROP CONSTRAINT IF EXISTS fk_task_tags_task;

ALTER TABLE task_tags
  ADD CONSTRAINT fk_task_tags_task
  FOREIGN KEY (task_id) REFERENCES tasks(id)
  ON DELETE CASCADE;

-- よく使うなら index
CREATE INDEX IF NOT EXISTS idx_task_tags_task_id ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag);
