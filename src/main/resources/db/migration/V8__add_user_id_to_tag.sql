-- 1) tag に user_id を追加（これはOK）
ALTER TABLE todomoney.tag
  ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- 2) 外部キーは「既にあれば作らない」を DO で実現
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_tag_user'
  ) THEN
    ALTER TABLE todomoney.tag
      ADD CONSTRAINT fk_tag_user
      FOREIGN KEY (user_id)
      REFERENCES todomoney.users(id)
      ON DELETE CASCADE;
  END IF;
END $$;
