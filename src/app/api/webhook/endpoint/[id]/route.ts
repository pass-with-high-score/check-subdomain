import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// PATCH: Update endpoint details (name)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const { id: endpointId } = await params;

    try {
        const body = await request.json();
        const { name } = body;

        if (name === undefined) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const [updated] = await sql`
            UPDATE webhook_endpoints 
            SET name = ${name}
            WHERE id = ${endpointId}::uuid
            RETURNING id, name, created_at
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
