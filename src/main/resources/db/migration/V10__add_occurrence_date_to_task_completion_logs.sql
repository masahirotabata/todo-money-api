-- もし schema を todomoney で運用しているなら schema を明示
ALTER TABLE todomoney.task_completion_logs
ADD COLUMN occurrence_date date;

-- 必須扱いにしたいなら（既存行があるとNGになるので、順序が大事）
-- 1) 先にNULL許可で追加 → 2) 値を埋める → 3) NOT NULL化
-- UPDATE todomoney.task_completion_logs SET occurrence_date = CURRENT_DATE WHERE occurrence_date IS NULL;
-- ALTER TABLE todomoney.task_completion_logs ALTER COLUMN occurrence_date SET NOT NULL;
