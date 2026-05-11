DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'tasks'
    ) THEN
        ALTER TABLE tasks
        ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
    END IF;
END $$;
