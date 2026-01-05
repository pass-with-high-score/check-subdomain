import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// DELETE: Remove a specific webhook request
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const { id: requestId } = await params;

    try {
        await sql`
            DELETE FROM webhook_requests WHERE id = ${parseInt(requestId)}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete request:', error);
        return NextResponse.json(
            { error: 'Failed to delete request' },
            { status: 500 }
        );
    }
}
