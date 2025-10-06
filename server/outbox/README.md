Outbox Publisher (LISTEN/NOTIFY)

- Table: server/outbox/sql/outbox.sql creates an outbox table with pending/publishing/published/failed states, attempts, next_attempt_at, and a LISTEN/NOTIFY trigger (channel: outbox_new) with payload {id, shard}.
- Shard key: districtId:documentId to preserve per-document ordering while enabling parallelism.
- Publisher: server/outbox/publisher.ts uses:
  - LISTEN outbox_new to react to inserts with minimal latency.
  - Polling fallback every 15s.
  - 5 retries with exponential backoff; mark failed after exceeding max.
  - Publishes to Pub/Sub with orderingKey and attributes (eventId, correlationId, version, producer, customerUuid, districtId).
- DLQ: Stubbed; failures mark the row failed and can be harvested by a future DLQ handler.

Integration notes:
- Insert outbox rows inside the same DB transaction as domain writes at:
  1) assessment.uploaded (document creation path)
  2) analysis.requested (analysis trigger)
  3) export.requested (export queue creation)
- Ordering key: documentId where applicable; else a suitable business key.
- Idempotency: consumers dedupe via eventId/correlationId plus natural keys.
