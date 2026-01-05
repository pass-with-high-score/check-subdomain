import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// SSE endpoint for real-time webhook updates
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id: endpointId } = await params;

    // Set up SSE headers
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Verify endpoint exists
            const [endpoint] = await sql`
                SELECT id FROM webhook_endpoints WHERE id = ${endpointId}::uuid
            `;

            if (!endpoint) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Endpoint not found' })}\n\n`));
                controller.close();
                return;
            }

            // Track last request ID to send only new ones
            let lastId = 0;

            // Initial load - send existing requests
            const initialRequests = await sql`
                SELECT id, method, headers, body, query_params, content_length, created_at
                FROM webhook_requests
                WHERE endpoint_id = ${endpointId}::uuid
                ORDER BY created_at DESC
                LIMIT 100
            `;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'init', requests: initialRequests })}\n\n`));

            if (initialRequests.length > 0) {
                lastId = Math.max(...initialRequests.map(r => r.id as number));
            }

            // Poll for new requests every second
            const interval = setInterval(async () => {
                try {
                    const newRequests = await sql`
                        SELECT id, method, headers, body, query_params, content_length, created_at
                        FROM webhook_requests
                        WHERE endpoint_id = ${endpointId}::uuid AND id > ${lastId}
                        ORDER BY id ASC
                    `;

                    if (newRequests.length > 0) {
                        lastId = Math.max(...newRequests.map(r => r.id as number));
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'new', requests: newRequests })}\n\n`));
                    }

                    // Send heartbeat to keep connection alive
                    controller.enqueue(encoder.encode(`: heartbeat\n\n`));
                } catch (error) {
                    console.error('SSE error:', error);
                }
            }, 1000);

            // Cleanup on close
            request.signal.addEventListener('abort', () => {
                clearInterval(interval);
                controller.close();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
