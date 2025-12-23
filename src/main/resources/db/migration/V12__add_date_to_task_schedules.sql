-- すでにテーブルがある前提で、足りないカラムだけ追加
ALTER TABLE task_schedules
ADD COLUMN IF NOT EXISTS date DATE;
