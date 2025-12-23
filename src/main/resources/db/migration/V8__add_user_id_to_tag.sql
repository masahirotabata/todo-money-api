-- 1) tag に user_id を追加
ALTER TABLE todomoney.tag
  ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- 2) 外部キー（tag.user_id -> users.id）
ALTER TABLE todomoney.tag
  ADD CONSTRAINT IF NOT EXISTS fk_tag_user
  FOREIGN KEY (user_id) REFERENCES todomoney.users(id)
  ON DELETE CASCADE;
