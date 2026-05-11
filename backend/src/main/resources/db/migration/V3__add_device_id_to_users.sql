ALTER TABLE users
  ADD COLUMN device_id VARCHAR(128);

ALTER TABLE users
  ADD CONSTRAINT users_device_id_unique UNIQUE (device_id);