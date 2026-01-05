import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface RouteParams {
    params: Promise<{ path: string[] }>;
}

// Handle ALL HTTP methods to receive webhooks
async function handleWebhook(request: NextRequest, { params }: RouteParams) {
    const { path } = await params;
    // First segment is the endpoint ID, rest are path parameters
    const endpointId = path[0];
    const pathParams = path.slice(1);

    try {
        // Verify endpoint exists
        const [endpoint] = await sql`
      SELECT id FROM webhook_endpoints WHERE id = ${endpointId}::uuid
    `;

        if (!endpoint) {
            return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
        }

        // Extract request data
        const method = request.method;
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headers[key] = value;
        });

        // Get query params
        const queryParams: Record<string, string> = {};
        request.nextUrl.searchParams.forEach((value, key) => {
            queryParams[key] = value;
        });

        // Add path params to query params for storage
        if (pathParams.length > 0) {
            queryParams['_path'] = '/' + pathParams.join('/');
        }

        // Get body as ArrayBuffer for binary safety
        let body = '';
        let isBinary = false;
        try {
            const arrayBuffer = await request.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Check if content is binary (contains null bytes or non-UTF8)
            const textDecoder = new TextDecoder('utf-8', { fatal: true });
            try {
                body = textDecoder.decode(bytes);
            } catch {
                // Binary content - encode as base64
                isBinary = true;
                body = Buffer.from(bytes).toString('base64');
            }
        } catch {
            // No body
        }

        // Add binary flag to queryParams if needed
        if (isBinary) {
            queryParams['_binary'] = 'true';
        }

        const contentLength = body.length;

        // Store the request
        const [newRequest] = await sql`
      INSERT INTO webhook_requests (endpoint_id, method, headers, body, query_params, content_length)
      VALUES (${endpointId}::uuid, ${method}, ${JSON.stringify(headers)}, ${body}, ${JSON.stringify(queryParams)}, ${contentLength})
      RETURNING id, created_at
    `;

        // Update last activity
        await sql`
      UPDATE webhook_endpoints 
      SET last_activity = NOW() 
      WHERE id = ${endpointId}::uuid
    `;

        return NextResponse.json({
            success: true,
            request_id: newRequest.id,
            message: 'Webhook received',
        });
    } catch (error) {
        console.error('Failed to process webhook:', error);
        return NextResponse.json(
            { error: 'Failed to process webhook' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest, params: RouteParams) {
    return handleWebhook(request, params);
}

export async function POST(request: NextRequest, params: RouteParams) {
    return handleWebhook(request, params);
}

export async function PUT(request: NextRequest, params: RouteParams) {
    return handleWebhook(request, params);
}

export async function PATCH(request: NextRequest, params: RouteParams) {
    return handleWebhook(request, params);
}

export async function DELETE(request: NextRequest, params: RouteParams) {
    return handleWebhook(request, params);
}
