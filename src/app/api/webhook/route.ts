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
export async function POST(request: NextRequest) {
    try {
        await ensureInitialized();

        // Parse optional name from body
        let name: string | null = null;
        try {
            const body = await request.json();
            name = body?.name || null;
        } catch {
            // No body or invalid JSON, proceed without name
        }

        const [endpoint] = await sql`
      INSERT INTO webhook_endpoints (name)
      VALUES (${name})
      RETURNING id, name, created_at
    `;

        return NextResponse.json({
            id: endpoint.id,
            name: endpoint.name,
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

// GET: Get endpoint(s) by ID(s)
export async function GET(request: NextRequest) {
    try {
        await ensureInitialized();

        const searchParams = request.nextUrl.searchParams;
        const endpointId = searchParams.get('id');
        const ids = searchParams.get('ids'); // Comma-separated IDs for batch query

        // Batch query for multiple endpoints
        if (ids) {
            const idArray = ids.split(',').filter(id => id.trim());
            if (idArray.length === 0) {
                return NextResponse.json({ endpoints: [] });
            }

            // Get endpoints with request counts
            const endpoints = await sql`
                SELECT 
                    e.id, 
                    e.name, 
                    e.created_at, 
                    e.last_activity,
                    COUNT(r.id)::int as request_count
                FROM webhook_endpoints e
                LEFT JOIN webhook_requests r ON r.endpoint_id = e.id
                WHERE e.id = ANY(${idArray}::uuid[])
                GROUP BY e.id, e.name, e.created_at, e.last_activity
            `;

            return NextResponse.json({ endpoints });
        }

        if (endpointId) {
            // Get specific endpoint with its requests
            const [endpoint] = await sql`
        SELECT id, name, created_at, last_activity 
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
