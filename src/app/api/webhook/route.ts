import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase, cleanupOldEndpoints } from '@/lib/db';

// Initialize database on first request
let initialized = false;
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

async function ensureInitialized() {
    if (!initialized) {
        await initDatabase();
        initialized = true;
    }

    // Run cleanup periodically (max once per hour)
    const now = Date.now();
    if (now - lastCleanup > CLEANUP_INTERVAL) {
        lastCleanup = now;
        // Run cleanup in background without blocking the request
        cleanupOldEndpoints().catch(err => console.error('Cleanup error:', err));
    }
}

// POST: Create new webhook endpoint
export async function POST() {
    try {
        await ensureInitialized();

        const [endpoint] = await sql`
      INSERT INTO webhook_endpoints DEFAULT VALUES
      RETURNING id, created_at
    `;

        return NextResponse.json({
            id: endpoint.id,
            url: `/api/hook/${endpoint.id}`,
            created_at: endpoint.created_at,
        });
    } catch (error) {
        console.error('Failed to create endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to create endpoint' },
            { status: 500 }
        );
    }
}

// GET: List recent endpoints (for debugging, optional)
export async function GET(request: NextRequest) {
    try {
        await ensureInitialized();

        const searchParams = request.nextUrl.searchParams;
        const endpointId = searchParams.get('id');

        if (endpointId) {
            // Get specific endpoint with its requests
            const [endpoint] = await sql`
        SELECT id, created_at, last_activity 
        FROM webhook_endpoints 
        WHERE id = ${endpointId}::uuid
      `;

            if (!endpoint) {
                return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
            }

            const requests = await sql`
        SELECT id, method, headers, body, query_params, content_length, created_at
        FROM webhook_requests
        WHERE endpoint_id = ${endpointId}::uuid
        ORDER BY created_at DESC
        LIMIT 100
      `;

            return NextResponse.json({
                endpoint,
                requests,
            });
        }

        return NextResponse.json({ error: 'Endpoint ID required' }, { status: 400 });
    } catch (error) {
        console.error('Failed to get endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to get endpoint' },
            { status: 500 }
        );
    }
}
