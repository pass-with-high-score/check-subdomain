import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Initialize tables
export async function initDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_activity TIMESTAMPTZ DEFAULT NOW(),
      response_delay_ms INTEGER DEFAULT 0,
      response_status_code INTEGER DEFAULT 200
    )
  `;

  // Add name column if it doesn't exist (migration for existing tables)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_endpoints' AND column_name = 'name'
      ) THEN
        ALTER TABLE webhook_endpoints ADD COLUMN name VARCHAR(100);
      END IF;
    END $$;
  `;

  // Add test options columns if they don't exist (migration for existing tables)
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_endpoints' AND column_name = 'response_delay_ms'
      ) THEN
        ALTER TABLE webhook_endpoints ADD COLUMN response_delay_ms INTEGER DEFAULT 0;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'webhook_endpoints' AND column_name = 'response_status_code'
      ) THEN
        ALTER TABLE webhook_endpoints ADD COLUMN response_status_code INTEGER DEFAULT 200;
      END IF;
    END $$;
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_requests (
      id SERIAL PRIMARY KEY,
      endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      method VARCHAR(10),
      headers JSONB,
      body TEXT,
      query_params JSONB,
      content_length INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_requests_endpoint_id 
    ON webhook_requests(endpoint_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_last_activity 
    ON webhook_endpoints(last_activity)
  `;
}

// Cleanup old endpoints (7 days inactive)
export async function cleanupOldEndpoints() {
  await sql`
    DELETE FROM webhook_endpoints 
    WHERE last_activity < NOW() - INTERVAL '7 days'
  `;
}
