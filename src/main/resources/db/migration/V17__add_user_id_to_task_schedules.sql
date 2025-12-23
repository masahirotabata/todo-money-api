-- 1) まず nullable で追加（既存行があると NOT NULL で追加できないため）
ALTER TABLE task_schedules
ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- 2) 既存データがある場合の埋め（とりあえず user_id=1 に寄せる）
--    ※あなたのDBは最初のユーザーが id=1 の前提で進めます
UPDATE task_schedules
SET user_id = 1
WHERE user_id IS NULL;

-- 3) 外部キー（users テーブル名が user / users どっちかで違う）
--    まずは "users" で作り、失敗したら "user" に変えてください
ALTER TABLE task_schedules
ADD CONSTRAINT IF NOT EXISTS fk_task_schedules_user
FOREIGN KEY (user_id) REFERENCES users(id);

-- 4) 最後に NOT NULL
ALTER TABLE task_schedules
ALTER COLUMN user_id SET NOT NULL;

-- 5) よく使うので index も追加
CREATE INDEX IF NOT EXISTS idx_task_schedules_user_id ON task_schedules(user_id);
