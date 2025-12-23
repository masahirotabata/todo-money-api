-- todomoney スキーマに color 追加
ALTER TABLE todomoney.tag
  ADD COLUMN IF NOT EXISTS color VARCHAR(30);

-- もし public.tag を作っている/参照している場合の保険
ALTER TABLE public.tag
  ADD COLUMN IF NOT EXISTS color VARCHAR(30);
