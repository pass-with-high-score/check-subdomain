import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class R2Service {
    private readonly logger = new Logger(R2Service.name);
    private readonly r2Client: S3Client;
    private readonly bucket: string;

    constructor(private configService: ConfigService) {
        const endpoint = this.configService.get<string>('S3_ENDPOINT');
        const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
        const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
        this.bucket = this.configService.get<string>('S3_BUCKET') || '';

        if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
            this.logger.warn('⚠️ R2 environment variables not fully configured');
        }

        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
        });
    }

    /**
     * Upload an object to R2 storage
     */
    async uploadObject(objectKey: string, body: Buffer, contentType: string): Promise<void> {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
                Body: body,
                ContentType: contentType,
            });

            await this.r2Client.send(command);
            this.logger.debug(`Uploaded object: ${objectKey}`);
        } catch (error) {
            this.logger.error(`Failed to upload object ${objectKey}:`, error);
            throw error;
        }
    }

    /**
     * Upload an object from file path using streaming (memory efficient)
     * @param objectKey - The object key (path) in R2
     * @param filePath - Local file path to upload
     * @param contentType - MIME type
     * @returns The file size in bytes
     */
    async uploadObjectFromFile(objectKey: string, filePath: string, contentType: string): Promise<number> {
        const fs = await import('fs');
        const { stat } = await import('fs/promises');

        try {
            const fileStats = await stat(filePath);
            const fileSize = fileStats.size;
            const stream = fs.createReadStream(filePath);

            const command = new PutObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
                Body: stream,
                ContentType: contentType,
                ContentLength: fileSize,
            });

            await this.r2Client.send(command);
            this.logger.debug(`Uploaded object from file: ${objectKey} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
            return fileSize;
        } catch (error) {
            this.logger.error(`Failed to upload object ${objectKey}:`, error);
            throw error;
        }
    }

    /**
     * Get an object from R2 storage
     */
    async getObject(objectKey: string): Promise<Buffer> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            });

            const response = await this.r2Client.send(command);

            if (!response.Body) {
                throw new Error('Empty response body');
            }

            // Convert stream to buffer
            const stream = response.Body as Readable;
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
            }
            return Buffer.concat(chunks);
        } catch (error) {
            this.logger.error(`Failed to get object ${objectKey}:`, error);
            throw error;
        }
    }

    /**
     * Delete an object from R2 storage
     * @param objectKey - The object key (path) to delete
     */
    async deleteObject(objectKey: string): Promise<void> {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
            });

            await this.r2Client.send(command);
            this.logger.debug(`Deleted object: ${objectKey}`);
        } catch (error) {
            this.logger.error(`Failed to delete object ${objectKey}:`, error);
            throw error;
        }
    }

    /**
     * Generate a presigned URL for direct download from R2
     * @param objectKey - The object key (path) in R2
     * @param expiresIn - URL expiration time in seconds (default: 1 hour)
     * @param filename - Optional filename for Content-Disposition header
     * @returns Presigned URL for direct download
     */
    async getPresignedUrl(objectKey: string, expiresIn = 3600, filename?: string): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: this.bucket,
                Key: objectKey,
                ResponseContentDisposition: filename
                    ? `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
                    : undefined,
            });

            const url = await getSignedUrl(this.r2Client, command, { expiresIn });
            this.logger.debug(`Generated presigned URL for: ${objectKey}`);
            return url;
        } catch (error) {
            this.logger.error(`Failed to generate presigned URL for ${objectKey}:`, error);
            throw error;
        }
    }
}

