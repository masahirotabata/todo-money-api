-- Vxx__alter_goals_annual_income_to_double.sql
ALTER TABLE todomoney.goals
  ALTER COLUMN annual_income TYPE double precision
  USING annual_income::double precision;