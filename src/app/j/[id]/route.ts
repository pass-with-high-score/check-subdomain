import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// CORS headers for public JSON access
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
};

const MAX_DELAY_MS = 30000; // Max 30 seconds

// Parse delay value: 2000, "2s", "500ms"
function parseDelay(value: string | null): number {
    if (!value) return 0;

    const trimmed = value.trim().toLowerCase();

    // Parse with suffix
    const match = trimmed.match(/^(\d+(?:\.\d+)?)(ms|s)?$/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unit = match[2] || 'ms';

    let ms: number;
    if (unit === 's') {
        ms = num * 1000;
    } else {
        ms = num;
    }

    return Math.min(Math.max(0, Math.round(ms)), MAX_DELAY_MS);
}

// Pick specific keys from object
function pickKeys(obj: unknown, keys: string[]): unknown {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) {
        return obj.map(item => pickKeys(item, keys));
    }

    const result: Record<string, unknown> = {};
    for (const key of keys) {
        if (key in (obj as Record<string, unknown>)) {
            result[key] = (obj as Record<string, unknown>)[key];
        }
    }
    return result;
}

// Simple JSONPath implementation (just basic path like "$.users[0].name")
function jsonPath(obj: unknown, path: string): unknown {
    if (!path.startsWith('$.')) return obj;

    const parts = path.slice(2).split(/\.|\[|\]/).filter(Boolean);
    let current: unknown = obj;

    for (const part of parts) {
        if (current === null || current === undefined) return undefined;

        if (typeof current === 'object') {
            if (Array.isArray(current)) {
                const index = parseInt(part, 10);
                if (!isNaN(index)) {
                    current = current[index];
                } else {
                    // Arrays don't have string keys in this context
                    return undefined;
                }
            } else {
                current = (current as Record<string, unknown>)[part];
            }
        } else {
            return undefined;
        }
    }

    return current;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const searchParams = request.nextUrl.searchParams;

        // Parse query params
        const delay = parseDelay(searchParams.get('delay'));
        const pathQuery = searchParams.get('path');
        const pickQuery = searchParams.get('pick');

        // Apply delay if specified
        if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await sql`
            SELECT content, expires_at
            FROM json_bins
            WHERE id = ${id}
              AND (expires_at IS NULL OR expires_at > NOW())
        `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Not found or expired.' },
                { status: 404, headers: corsHeaders }
            );
        }

        let content = result[0].content;
        let parsed: unknown;

        // Apply transformations if requested
        if (pathQuery || pickQuery) {
            try {
                parsed = JSON.parse(content);

                // Apply JSONPath
                if (pathQuery) {
                    parsed = jsonPath(parsed, pathQuery);
                }

                // Apply pick keys
                if (pickQuery) {
                    const keys = pickQuery.split(',').map(k => k.trim()).filter(Boolean);
                    if (keys.length > 0) {
                        parsed = pickKeys(parsed, keys);
                    }
                }

                content = JSON.stringify(parsed);
            } catch {
                // If parsing fails, return original content
            }
        }

        // Return JSON content
        return new NextResponse(content, {
            status: 200,
            headers: {
                ...corsHeaders,
                'X-Delay-Applied': delay > 0 ? `${delay}ms` : '0',
            },
        });
    } catch (error) {
        console.error('Error fetching JSON:', error);
        return NextResponse.json(
            { error: 'Server error.' },
            { status: 500, headers: corsHeaders }
        );
    }
}
