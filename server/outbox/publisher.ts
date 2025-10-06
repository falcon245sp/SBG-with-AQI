import { Pool } from 'pg';
import { PubSub } from '@google-cloud/pubsub';

type OutboxRow = {
  id: string;
  topic: string;
  payload: any;
  status: 'pending' | 'publishing' | 'published' | 'failed';
  attempts: number;
  ordering_key: string | null;
  event_id: string;
  correlation_id: string | null;
  customer_uuid: string;
  district_id: string;
  shard_key: string;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
};

const MAX_RETRIES = parseInt(process.env.OUTBOX_MAX_RETRIES || '5', 10);
const BACKOFF_BASE_MS = parseInt(process.env.OUTBOX_BACKOFF_BASE_MS || '2000', 10);
const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '15000', 10);

export class OutboxPublisher {
  private pool: Pool;
  private pubsub: PubSub;
  private stop = false;

  constructor(pool: Pool, pubsub?: PubSub) {
    this.pool = pool;
    this.pubsub = pubsub || new PubSub();
  }

  async start() {
    const client = await this.pool.connect();
    try {
      await client.query('LISTEN outbox_new');
      client.on('notification', (msg) => {
        if (msg.channel === 'outbox_new') {
          this.processAvailable().catch(() => {});
        }
      });
    } finally {
      client.release();
    }
    this.loopPoll();
  }

  stopSync() {
    this.stop = true;
  }

  private async loopPoll() {
    while (!this.stop) {
      try {
        await this.processAvailable();
      } catch {}
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  private async processAvailable() {
    let row: OutboxRow | null;
    while ((row = await this.leaseOne())) {
      try {
        await this.publishRow(row);
        await this.markPublished(row.id);
      } catch (err) {
        await this.handleFailure(row.id, row.attempts);
      }
    }
  }

  private async leaseOne(): Promise<OutboxRow | null> {
    const sql = `
      WITH cte AS (
        SELECT id
        FROM outbox
        WHERE status = 'pending'
          AND next_attempt_at <= now()
        ORDER BY created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE outbox o
      SET status = 'publishing', updated_at = now()
      FROM cte
      WHERE o.id = cte.id
      RETURNING o.*;
    `;
    const res = await this.pool.query(sql);
    if (res.rowCount === 0) return null;
    return res.rows[0] as OutboxRow;
  }

  private async publishRow(row: OutboxRow) {
    const dataBuffer = Buffer.from(JSON.stringify(row.payload));
    const attributes: Record<string, string> = {
      eventId: row.event_id,
      correlationId: row.correlation_id || '',
      customerUuid: row.customer_uuid,
      districtId: row.district_id,
      version: 'v1',
      producer: 'SBG-with-AQI',
      shardKey: row.shard_key,
    };

    const topic = this.pubsub.topic(row.topic, {
      messageOrdering: !!row.ordering_key,
    });

    await topic.publishMessage({
      data: dataBuffer,
      orderingKey: row.ordering_key || undefined,
      attributes,
    });
  }

  private async markPublished(id: string) {
    await this.pool.query(
      `UPDATE outbox SET status='published', updated_at=now() WHERE id=$1`,
      [id]
    );
  }

  private async handleFailure(id: string, attempts: number) {
    const nextAttempts = attempts + 1;
    const backoff = Math.pow(2, attempts) * BACKOFF_BASE_MS;
    if (nextAttempts >= MAX_RETRIES) {
      await this.pool.query(
        `UPDATE outbox SET status='failed', attempts=$2, updated_at=now() WHERE id=$1`,
        [id, nextAttempts]
      );
      return;
    }
    await this.pool.query(
      `UPDATE outbox
         SET attempts=$2,
             status='pending',
             next_attempt_at=now() + make_interval(secs => $3 / 1000.0),
             updated_at=now()
       WHERE id=$1`,
      [id, nextAttempts, backoff]
    );
  }
}
