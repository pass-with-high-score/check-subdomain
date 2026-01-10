import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Sql } from 'postgres';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const postgres = require('postgres');

@Injectable()
export class DatabaseService implements OnModuleInit {
    private readonly logger = new Logger(DatabaseService.name);
    public sql: Sql;

    constructor(private configService: ConfigService) {
        const connectionString = this.configService.get<string>('DATABASE_URL');

        if (!connectionString) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        this.sql = postgres(connectionString, {
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
        });
    }

    async onModuleInit() {
        try {
            // Test connection
            await this.sql`SELECT 1`;
            this.logger.log('✅ Database connection established');
        } catch (error) {
            this.logger.error('❌ Database connection failed', error);
            throw error;
        }
    }

    /**
     * Get expired file transfers
     */
    async getExpiredTransfers() {
        return this.sql`
      SELECT id, object_key, filename 
      FROM file_transfers 
      WHERE expires_at < NOW()
    `;
    }

    /**
     * Delete a file transfer by ID
     */
    async deleteTransfer(id: string) {
        return this.sql`DELETE FROM file_transfers WHERE id = ${id}`;
    }

    /**
     * Cleanup old webhook endpoints (7 days inactive)
     */
    async cleanupOldEndpoints() {
        const result = await this.sql`
      DELETE FROM webhook_endpoints 
      WHERE last_activity < NOW() - INTERVAL '7 days'
      RETURNING id
    `;
        return result.length;
    }

    /**
     * Cleanup expired JSON bins
     */
    async cleanupExpiredJsonBins() {
        const result = await this.sql`
      DELETE FROM json_bins 
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
      RETURNING id
    `;
        return result.length;
    }

    // ============ Chat Messages ============

    /**
     * Initialize chat_messages table
     */
    async initChatMessagesTable() {
        await this.sql`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id VARCHAR(32) PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                color VARCHAR(7) NOT NULL,
                message TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        `;
        // Create index for faster queries
        await this.sql`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp 
            ON chat_messages(timestamp DESC)
        `;
        this.logger.log('✅ Chat messages table initialized');
    }

    /**
     * Save a chat message
     */
    async saveChatMessage(msg: { id: string; username: string; color: string; message: string; timestamp: number }) {
        await this.sql`
            INSERT INTO chat_messages (id, username, color, message, timestamp)
            VALUES (${msg.id}, ${msg.username}, ${msg.color}, ${msg.message}, ${msg.timestamp})
        `;
    }

    /**
     * Get recent chat messages (last 50)
     */
    async getRecentChatMessages(limit = 50) {
        const rows = await this.sql`
            SELECT id, username, color, message, timestamp
            FROM chat_messages
            ORDER BY timestamp DESC
            LIMIT ${limit}
        `;
        // Reverse to get chronological order
        return rows.reverse().map((row: { id: string; username: string; color: string; message: string; timestamp: string }) => ({
            id: row.id,
            username: row.username,
            color: row.color,
            message: row.message,
            timestamp: Number(row.timestamp),
        }));
    }

    /**
     * Cleanup old chat messages (keep only last 100)
     */
    async cleanupOldChatMessages() {
        const result = await this.sql`
            DELETE FROM chat_messages
            WHERE id NOT IN (
                SELECT id FROM chat_messages
                ORDER BY timestamp DESC
                LIMIT 100
            )
            RETURNING id
        `;
        return result.length;
    }

    // ============ Speech Transcriptions ============

    /**
     * Initialize speech_transcriptions table
     */
    async initSpeechTranscriptionsTable() {
        await this.sql`
            CREATE TABLE IF NOT EXISTS speech_transcriptions (
                id VARCHAR(32) PRIMARY KEY,
                object_key VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_size BIGINT NOT NULL,
                duration_seconds FLOAT,
                status VARCHAR(20) DEFAULT 'pending',
                transcript TEXT,
                words JSONB,
                language VARCHAR(10),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL
            )
        `;
        // Add words column if it doesn't exist (for existing tables)
        await this.sql`
            ALTER TABLE speech_transcriptions 
            ADD COLUMN IF NOT EXISTS words JSONB
        `;
        // Add paragraphs column if it doesn't exist
        await this.sql`
            ALTER TABLE speech_transcriptions 
            ADD COLUMN IF NOT EXISTS paragraphs JSONB
        `;
        await this.sql`
            CREATE INDEX IF NOT EXISTS idx_speech_expires 
            ON speech_transcriptions(expires_at)
        `;
        this.logger.log('✅ Speech transcriptions table initialized');
    }

    /**
     * Get expired speech transcriptions
     */
    async getExpiredSpeechTranscriptions() {
        return this.sql`
            SELECT id, object_key, filename 
            FROM speech_transcriptions 
            WHERE expires_at < NOW()
        `;
    }

    /**
     * Delete a speech transcription by ID
     */
    async deleteSpeechTranscription(id: string) {
        return this.sql`DELETE FROM speech_transcriptions WHERE id = ${id}`;
    }

    // ============ YouTube Downloads ============

    /**
     * Get expired YouTube downloads
     */
    async getExpiredYouTubeDownloads() {
        return this.sql`
            SELECT id, object_key 
            FROM youtube_downloads 
            WHERE expires_at < NOW()
        `;
    }

    /**
     * Delete a YouTube download by ID
     */
    async deleteYouTubeDownload(id: string) {
        return this.sql`DELETE FROM youtube_downloads WHERE id = ${id}`;
    }
}

