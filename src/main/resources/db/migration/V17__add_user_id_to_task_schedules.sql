-- 1) nullableで追加
ALTER TABLE task_schedules
ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- 2) 既存行を埋める（仮で1）
UPDATE task_schedules
SET user_id = 1
WHERE user_id IS NULL;

-- 3) 外部キーは「存在したら消して、作り直す」方式（IF NOT EXISTSが使えないため）
ALTER TABLE task_schedules
DROP CONSTRAINT IF EXISTS fk_task_schedules_user;

ALTER TABLE task_schedules
ADD CONSTRAINT fk_task_schedules_user
FOREIGN KEY (user_id) REFERENCES users(id);

-- 4) NOT NULL
ALTER TABLE task_schedules
ALTER COLUMN user_id SET NOT NULL;

-- 5) index
CREATE INDEX IF NOT EXISTS idx_task_schedules_user_id ON task_schedules(user_id);
