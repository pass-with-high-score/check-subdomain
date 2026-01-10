/**
 * Time Capsule API - Upload proxy
 * POST /api/capsule/[id]/upload - Proxy upload to R2 (avoids CORS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql, initDatabase } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize database on first request
let dbInitialized = false;

// Create S3 client for R2
const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
});

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        if (!dbInitialized) {
            await initDatabase();
            dbInitialized = true;
        }

        const { id } = await params;

        // Get capsule info
        const result = await sql`
      SELECT id, object_key, content_type, file_size, uploaded_at
      FROM time_capsules
      WHERE id = ${id}
    `;

        if (result.length === 0) {
            return NextResponse.json(
                { error: 'Capsule not found' },
                { status: 404 }
            );
        }

        const capsule = result[0];

        // Check if already uploaded
        if (capsule.uploaded_at) {
            return NextResponse.json(
                { error: 'File already uploaded' },
                { status: 400 }
            );
        }

        // Get file from request
        const contentType = request.headers.get('content-type') || capsule.content_type || 'application/octet-stream';
        const body = await request.arrayBuffer();

        // Validate file size
        if (body.byteLength > capsule.file_size * 1.1) { // Allow 10% overhead
            return NextResponse.json(
                { error: 'File size mismatch' },
                { status: 400 }
            );
        }

        // Upload to R2
        const uploadCommand = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: capsule.object_key,
            Body: Buffer.from(body),
            ContentType: contentType,
        });

        await r2Client.send(uploadCommand);

        // Update database
        await sql`
      UPDATE time_capsules
      SET uploaded_at = NOW()
      WHERE id = ${id}
    `;

        return NextResponse.json({
            success: true,
            message: 'File uploaded successfully',
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}

// Route segment config for App Router
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for large uploads
