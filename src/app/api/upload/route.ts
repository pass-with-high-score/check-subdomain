/**
 * Image Upload API
 * Upload images to R2 storage and get public URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadObject, getPublicUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';

        // Check if it's a file upload
        if (!ALLOWED_TYPES.some(type => contentType.startsWith(type))) {
            return NextResponse.json(
                { error: 'Invalid content type. Only images are allowed.' },
                { status: 400 }
            );
        }

        // Get file data
        const buffer = await request.arrayBuffer();
        const fileSize = buffer.byteLength;

        if (fileSize > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
                { status: 400 }
            );
        }

        if (fileSize === 0) {
            return NextResponse.json(
                { error: 'Empty file' },
                { status: 400 }
            );
        }

        // Get filename from header or generate one
        const filename = request.headers.get('x-filename') || `image_${Date.now()}`;
        const extension = getExtension(contentType);

        // Generate unique object key
        const id = randomUUID();
        const objectKey = `uploads/${id}/${sanitizeFilename(filename)}${extension}`;

        // Upload to R2
        await uploadObject(objectKey, Buffer.from(buffer), contentType);

        // Get public URL
        const url = getPublicUrl(objectKey);

        return NextResponse.json({
            id,
            url,
            filename: `${sanitizeFilename(filename)}${extension}`,
            size: fileSize,
            contentType,
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload image' },
            { status: 500 }
        );
    }
}

function getExtension(contentType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
    };
    return map[contentType] || '.png';
}

function sanitizeFilename(filename: string): string {
    // Remove extension if present
    const withoutExt = filename.replace(/\.(jpg|jpeg|png|gif|webp|svg)$/i, '');
    // Keep only safe characters
    return withoutExt.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
}
