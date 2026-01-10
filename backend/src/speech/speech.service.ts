import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, DeepgramClient } from '@deepgram/sdk';
import { DatabaseService } from '../database/database.service';
import { R2Service } from '../storage/r2.service';

export interface WordTiming {
    word: string;
    start: number;
    end: number;
}

export interface Paragraph {
    text: string;
    start: number;
    end: number;
}

export interface SpeechTranscription {
    id: string;
    object_key: string;
    filename: string;
    file_size: number;
    duration_seconds: number | null;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    transcript: string | null;
    words: WordTiming[] | null;
    paragraphs: Paragraph[] | null;
    language: string | null;
    audio_url?: string;
    created_at: Date;
    expires_at: Date;
}

@Injectable()
export class SpeechService implements OnModuleInit {
    private readonly logger = new Logger(SpeechService.name);
    private deepgram: DeepgramClient;

    constructor(
        private readonly configService: ConfigService,
        private readonly databaseService: DatabaseService,
        private readonly r2Service: R2Service,
    ) {
        const apiKey = this.configService.get<string>('DEEPGRAM_API_KEY');
        if (!apiKey) {
            throw new Error('DEEPGRAM_API_KEY is required');
        }
        this.deepgram = createClient(apiKey);
    }

    async onModuleInit() {
        await this.databaseService.initSpeechTranscriptionsTable();
    }

    /**
     * Generate random ID
     */
    private generateId(): string {
        return Math.random().toString(36).substring(2, 8) +
            Date.now().toString(36);
    }

    /**
     * Upload audio file and create transcription record
     */
    async uploadAudio(file: { originalname: string; buffer: Buffer; mimetype: string; size: number }): Promise<SpeechTranscription> {
        const id = this.generateId();
        const objectKey = `speech/${id}/${file.originalname}`;

        // Upload to S3/R2
        await this.r2Service.uploadObject(objectKey, file.buffer, file.mimetype);

        // Calculate expiry (1 hour from now)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        // Create database record
        await this.databaseService.sql`
            INSERT INTO speech_transcriptions (id, object_key, filename, file_size, status, expires_at)
            VALUES (${id}, ${objectKey}, ${file.originalname}, ${file.size}, 'pending', ${expiresAt})
        `;

        this.logger.log(`📤 Uploaded audio: ${id} (${file.originalname})`);

        return {
            id,
            object_key: objectKey,
            filename: file.originalname,
            file_size: file.size,
            duration_seconds: null,
            status: 'pending',
            transcript: null,
            words: null,
            paragraphs: null,
            language: null,
            created_at: new Date(),
            expires_at: expiresAt,
        };
    }

    /**
     * Start transcription for an audio file
     */
    async transcribe(id: string, language: string = 'vi'): Promise<SpeechTranscription> {
        // Get record
        const records = await this.databaseService.sql`
            SELECT * FROM speech_transcriptions WHERE id = ${id}
        `;

        if (records.length === 0) {
            throw new NotFoundException('Transcription not found');
        }

        const record = records[0];

        // Update status to processing
        await this.databaseService.sql`
            UPDATE speech_transcriptions SET status = 'processing' WHERE id = ${id}
        `;

        try {
            // Get audio file from S3
            const audioBuffer = await this.r2Service.getObject(record.object_key);

            // Detect mimetype from filename
            const ext = record.filename.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'mp3': 'audio/mpeg',
                'wav': 'audio/wav',
                'ogg': 'audio/ogg',
                'webm': 'audio/webm',
                'm4a': 'audio/mp4',
                'flac': 'audio/flac',
            };
            const mimetype = mimeTypes[ext || ''] || 'audio/mpeg';

            // Call Deepgram API
            this.logger.log(`🎤 Transcribing: ${id} (language: ${language})`);

            // Build options - don't pass language when auto-detecting
            const deepgramOptions: Record<string, unknown> = {
                model: 'nova-2',
                smart_format: true,
                punctuate: true,
                paragraphs: true,
                mimetype,
            };

            if (language === 'auto') {
                deepgramOptions.detect_language = true;
            } else {
                deepgramOptions.language = language;
            }

            const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
                audioBuffer,
                deepgramOptions
            );

            // Log result for debugging
            this.logger.debug(`Deepgram result channels: ${result?.results?.channels?.length || 0}`);
            this.logger.debug(`Deepgram alternatives: ${result?.results?.channels?.[0]?.alternatives?.length || 0}`);

            // Extract transcript and word-level timestamps
            const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            const detectedLanguage = result?.results?.channels?.[0]?.detected_language || language;
            const duration = result?.metadata?.duration || null;

            // Extract word-level timestamps
            const rawWords = result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
            const words: WordTiming[] = rawWords.map((w: { word: string; start: number; end: number }) => ({
                word: w.word,
                start: w.start,
                end: w.end,
            }));

            // Extract paragraphs
            const rawParagraphs = result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const paragraphs: Paragraph[] = rawParagraphs.map((p: any) => {
                // Combine all sentences in the paragraph
                const sentences = p.sentences || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const text = sentences.map((s: any) => s.text).join(' ');
                return {
                    text,
                    start: p.start,
                    end: p.end,
                };
            });

            // Update database
            const wordsJson = JSON.stringify(words);
            const paragraphsJson = JSON.stringify(paragraphs);
            await this.databaseService.sql`
                UPDATE speech_transcriptions 
                SET status = 'completed', transcript = ${transcript}, language = ${detectedLanguage}, duration_seconds = ${duration}, words = ${wordsJson}, paragraphs = ${paragraphsJson}
                WHERE id = ${id}
            `;

            this.logger.log(`✅ Transcription complete: ${id} (${words.length} words, ${paragraphs.length} paragraphs)`);

            return {
                id: record.id,
                object_key: record.object_key,
                filename: record.filename,
                file_size: record.file_size,
                duration_seconds: duration,
                status: 'completed' as const,
                transcript,
                words,
                paragraphs,
                language: detectedLanguage,
                created_at: record.created_at,
                expires_at: record.expires_at,
            };
        } catch (error) {
            this.logger.error(`❌ Transcription failed: ${id}`, error);

            await this.databaseService.sql`
                UPDATE speech_transcriptions SET status = 'failed' WHERE id = ${id}
            `;

            throw error;
        }
    }

    /**
     * Get transcription by ID
     */
    async getTranscription(id: string): Promise<SpeechTranscription> {
        const records = await this.databaseService.sql`
            SELECT * FROM speech_transcriptions WHERE id = ${id}
        `;

        if (records.length === 0) {
            throw new NotFoundException('Transcription not found');
        }

        const record = records[0];

        // Parse JSONB fields if they're strings
        return {
            ...record,
            words: typeof record.words === 'string' ? JSON.parse(record.words) : record.words,
            paragraphs: typeof record.paragraphs === 'string' ? JSON.parse(record.paragraphs) : record.paragraphs,
        } as SpeechTranscription;
    }

    /**
     * Get expired speech transcriptions
     */
    async getExpiredTranscriptions() {
        return this.databaseService.sql`
            SELECT id, object_key, filename 
            FROM speech_transcriptions 
            WHERE expires_at < NOW()
        `;
    }

    /**
     * Delete a speech transcription
     */
    async deleteTranscription(id: string, objectKey: string) {
        await this.r2Service.deleteObject(objectKey);
        await this.databaseService.sql`
            DELETE FROM speech_transcriptions WHERE id = ${id}
        `;
    }

    /**
     * Get audio file buffer for streaming
     */
    async getAudioFile(id: string): Promise<{ buffer: Buffer; contentType: string }> {
        const records = await this.databaseService.sql`
            SELECT object_key, filename FROM speech_transcriptions WHERE id = ${id}
        `;

        if (records.length === 0) {
            throw new NotFoundException('Transcription not found');
        }

        const record = records[0];
        const buffer = await this.r2Service.getObject(record.object_key);

        // Detect content type from filename
        const ext = record.filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'webm': 'audio/webm',
            'm4a': 'audio/mp4',
            'flac': 'audio/flac',
        };
        const contentType = mimeTypes[ext || ''] || 'audio/mpeg';

        return { buffer, contentType };
    }
}

