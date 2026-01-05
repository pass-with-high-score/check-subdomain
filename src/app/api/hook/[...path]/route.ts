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

    // Max timeout: 10 minutes = 600000ms
    const MAX_TIMEOUT_MS = 600000;

    // Helper function to parse timeout value from string
    // Supports: 2000 (ms), "2000ms", "2s", "2m", "2m 14s", "1m 30s"
    const parseTimeout = (value: string | null): number | null => {
        if (!value) return null;

        const trimmed = value.trim().toLowerCase();

        // Try parsing combined format "2m 14s" or "1m 30s"
        const combinedMatch = trimmed.match(/^(\d+)\s*m\s+(\d+)\s*s$/);
        if (combinedMatch) {
            const mins = parseInt(combinedMatch[1], 10);
            const secs = parseInt(combinedMatch[2], 10);
            const ms = (mins * 60 + secs) * 1000;
            return Math.min(Math.max(0, ms), MAX_TIMEOUT_MS);
        }

        // Try parsing with single unit suffix
        const singleMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m)?$/);
        if (!singleMatch) return null;

        const num = parseFloat(singleMatch[1]);
        const unit = singleMatch[2] || 'ms'; // default to milliseconds

        let ms: number;
        switch (unit) {
            case 'm':
                ms = num * 60 * 1000;
                break;
            case 's':
                ms = num * 1000;
                break;
            case 'ms':
            default:
                ms = num;
        }

        // Clamp to max timeout
        return Math.min(Math.max(0, Math.round(ms)), MAX_TIMEOUT_MS);
    };

    try {
        // Verify endpoint exists and get test options
        const [endpoint] = await sql`
      SELECT id, response_delay_ms, response_status_code 
      FROM webhook_endpoints 
      WHERE id = ${endpointId}::uuid
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

        // Determine delay: query param takes priority over saved setting
        const timeoutParam = request.nextUrl.searchParams.get('timeout');
        const parsedTimeout = parseTimeout(timeoutParam);
        const delayMs = parsedTimeout !== null ? parsedTimeout : (endpoint.response_delay_ms || 0);

        // Apply delay BEFORE storing request (so it only appears after delay)
        if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Store the request (after delay so it appears when response is ready)
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

        // Determine status code: query param takes priority over saved setting
        const statusParam = request.nextUrl.searchParams.get('status');
        const parsedStatus = statusParam ? parseInt(statusParam, 10) : null;
        const validCodes = [200, 201, 400, 401, 403, 404, 429, 500, 502, 503, 504];
        const statusCode = (parsedStatus && validCodes.includes(parsedStatus))
            ? parsedStatus
            : (endpoint.response_status_code || 200);

        return NextResponse.json(
            {
                success: statusCode >= 200 && statusCode < 300,
                request_id: newRequest.id,
                message: 'Webhook received',
                applied_delay_ms: delayMs,
                applied_status_code: statusCode,
            },
            { status: statusCode }
        );
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
