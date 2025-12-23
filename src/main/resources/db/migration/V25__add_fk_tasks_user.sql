ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_user
  FOREIGN KEY (user_id) REFERENCES users(id);
