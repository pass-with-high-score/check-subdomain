import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH: Update endpoint details (name, test options)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { id: endpointId } = await params;

    try {
        const body = await request.json();
        const { name, response_delay_ms, response_status_code } = body;

        // Validate test options if provided
        if (response_delay_ms !== undefined) {
            const delay = Number(response_delay_ms);
            if (isNaN(delay) || delay < 0 || delay > 30000) {
                return NextResponse.json(
                    { error: 'response_delay_ms must be between 0 and 30000' },
                    { status: 400 }
                );
            }
        }

        if (response_status_code !== undefined) {
            const statusCode = Number(response_status_code);
            const validCodes = [200, 201, 400, 401, 403, 404, 429, 500, 502, 503, 504];
            if (!validCodes.includes(statusCode)) {
                return NextResponse.json(
                    { error: 'Invalid status code' },
                    { status: 400 }
                );
            }
        }

        // Prepare typed values for SQL
        const nameValue: string | null = name !== undefined ? String(name) : null;
        const delayValue: number | null = response_delay_ms !== undefined ? Number(response_delay_ms) : null;
        const statusValue: number | null = response_status_code !== undefined ? Number(response_status_code) : null;

        if (nameValue === null && delayValue === null && statusValue === null) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Using individual updates for simplicity
        const [updated] = await sql`
            UPDATE webhook_endpoints 
            SET 
                name = COALESCE(${nameValue}, name),
                response_delay_ms = COALESCE(${delayValue}, response_delay_ms),
                response_status_code = COALESCE(${statusValue}, response_status_code)
            WHERE id = ${endpointId}::uuid
            RETURNING id, name, created_at, response_delay_ms, response_status_code
        `;

        if (!updated) {
            return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Failed to update endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to update endpoint' },
            { status: 500 }
        );
    }
}

// DELETE: Delete entire endpoint and all its requests
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: endpointId } = await params;

    try {
        await sql`
            DELETE FROM webhook_endpoints WHERE id = ${endpointId}::uuid
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to delete endpoint' },
            { status: 500 }
        );
    }
}
