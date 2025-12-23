ALTER TABLE IF EXISTS todomoney.currency_events
  ALTER COLUMN amount TYPE double precision
  USING amount::double precision;

ALTER TABLE IF EXISTS public.currency_events
  ALTER COLUMN amount TYPE double precision
  USING amount::double precision;
