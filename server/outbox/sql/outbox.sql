
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|publishing|published|failed
  attempts int NOT NULL DEFAULT 0,
  ordering_key text,
  event_id uuid UNIQUE NOT NULL,
  correlation_id text,
  customer_uuid text NOT NULL,
  district_id text NOT NULL,
  shard_key text NOT NULL, -- districtId:documentId
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON outbox (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_shard_status ON outbox (shard_key, status);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox (created_at);

CREATE OR REPLACE FUNCTION notify_outbox_insert() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('outbox_new', json_build_object('id', NEW.id, 'shard', NEW.shard_key)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_notify ON outbox;
CREATE TRIGGER outbox_notify AFTER INSERT ON outbox
FOR EACH ROW EXECUTE FUNCTION notify_outbox_insert();
