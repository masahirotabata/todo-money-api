DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'tasks'
    ) THEN
        EXECUTE '
            ALTER TABLE public.tasks
            ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false
        ';
    END IF;
END $$;
