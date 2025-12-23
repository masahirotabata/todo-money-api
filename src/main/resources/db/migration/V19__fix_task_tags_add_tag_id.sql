-- 1) tags マスタが無いなら作る
CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

-- 2) task_tags に tag_id が無いなら追加
ALTER TABLE task_tags
  ADD COLUMN IF NOT EXISTS tag_id BIGINT;

-- 3) もし task_tags に "tag" 文字列カラムがあるなら、それを tags に移して tag_id を埋める
--    ※ tag カラムが無いならこのブロックはエラーになるので、あれば実行される形にしたい場合は手動で分ける
INSERT INTO tags(name)
SELECT DISTINCT tag
FROM task_tags
WHERE tag IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE task_tags tt
SET tag_id = t.id
FROM tags t
WHERE tt.tag IS NOT NULL
  AND t.name = tt.tag
  AND tt.tag_id IS NULL;

-- 4) 外部キー
ALTER TABLE task_tags
  DROP CONSTRAINT IF EXISTS fk_task_tags_tag;

ALTER TABLE task_tags
  ADD CONSTRAINT fk_task_tags_tag
  FOREIGN KEY (tag_id) REFERENCES tags(id)
  ON DELETE CASCADE;

-- 5) 可能なら NOT NULL に（データ埋まってから）
-- ALTER TABLE task_tags ALTER COLUMN tag_id SET NOT NULL;

-- 6) インデックス
CREATE INDEX IF NOT EXISTS idx_task_tags_tag_id ON task_tags(tag_id);
