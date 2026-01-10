import { Injectable, Logger, NotFoundException, OnModuleInit, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { R2Service } from '../storage/r2.service';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface FormatOption {
    quality: string;
    value: string;
}

export interface VideoInfo {
    videoId: string;
    title: string;
    thumbnail: string;
    duration: number;
    author: string;
    videoFormats: FormatOption[];
    audioFormats: FormatOption[];
}

export interface DownloadRequest {
    url: string;
    formatType: 'video' | 'audio';
    quality: string;
}

export interface DownloadResult {
    id: string;
    videoId: string;
    title: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    fileSize?: number;
    filename?: string;
    error?: string;
}

interface YtDlpVideoInfo {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    uploader: string;
    formats: Array<{
        format_id: string;
        ext: string;
        height?: number;
        vcodec?: string;
        acodec?: string;
        abr?: number;
        filesize?: number;
    }>;
}

@Injectable()
export class YouTubeService implements OnModuleInit {
    private readonly logger = new Logger(YouTubeService.name);
    private ytdlpPath = 'yt-dlp';
    // In-memory progress tracking (faster than DB updates)
    private progressMap = new Map<string, number>();

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly r2Service: R2Service,
    ) { }

    async onModuleInit() {
        await this.initTable();
        this.checkYtDlp();
    }

    private checkYtDlp() {
        try {
            const version = execSync(`${this.ytdlpPath} --version`, { encoding: 'utf-8' }).trim();
            this.logger.log(`📺 yt-dlp version: ${version}`);
        } catch {
            this.logger.warn('⚠️ yt-dlp not found. Please install it: brew install yt-dlp');
        }
    }

    private async initTable() {
        await this.databaseService.sql`
            CREATE TABLE IF NOT EXISTS youtube_downloads (
                id VARCHAR(16) PRIMARY KEY,
                video_id VARCHAR(32) NOT NULL,
                title TEXT,
                thumbnail_url TEXT,
                format_type VARCHAR(10),
                quality VARCHAR(20),
                object_key TEXT,
                filename TEXT,
                file_size BIGINT,
                progress INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'pending',
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                expires_at TIMESTAMP
            )
        `;
        this.logger.log('📺 YouTube downloads table initialized');
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
    }

    private extractVideoId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        ];
        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        return null;
    }

    /**
     * Get video information using yt-dlp
     */
    async getVideoInfo(url: string): Promise<VideoInfo> {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new BadRequestException('Invalid YouTube URL');
        }

        try {
            // Use yt-dlp to get video info with anti-bot measures
            const result = execSync(
                `${this.ytdlpPath} -j --no-download --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --extractor-args "youtube:player_client=web" "${url}"`,
                { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
            );

            const info: YtDlpVideoInfo = JSON.parse(result);

            // Predefined quality options
            const videoFormats: FormatOption[] = [
                { quality: '1080p', value: '1080' },
                { quality: '720p', value: '720' },
                { quality: '480p', value: '480' },
                { quality: '360p', value: '360' },
            ];

            const audioFormats: FormatOption[] = [
                { quality: 'Best', value: 'bestaudio' },
                { quality: '128kbps', value: '128' },
            ];

            return {
                videoId: info.id,
                title: info.title || 'Unknown',
                thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                duration: info.duration || 0,
                author: info.uploader || 'Unknown',
                videoFormats,
                audioFormats,
            };
        } catch (error) {
            this.logger.error('Failed to get video info:', error);
            // Fallback to oEmbed
            return this.getVideoInfoFallback(url, videoId);
        }
    }

    private async getVideoInfoFallback(url: string, videoId: string): Promise<VideoInfo> {
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
            const response = await fetch(oembedUrl);
            if (!response.ok) throw new Error('oEmbed failed');
            const data = await response.json();

            return {
                videoId,
                title: data.title || 'Unknown',
                thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                duration: 0,
                author: data.author_name || 'Unknown',
                videoFormats: [
                    { quality: '1080p', value: '1080' },
                    { quality: '720p', value: '720' },
                    { quality: '480p', value: '480' },
                ],
                audioFormats: [
                    { quality: 'Best', value: 'bestaudio' },
                ],
            };
        } catch {
            throw new BadRequestException('Failed to get video info');
        }
    }

    /**
     * Start download using yt-dlp
     */
    async startDownload(request: DownloadRequest): Promise<DownloadResult> {
        const id = this.generateId();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const videoId = this.extractVideoId(request.url) || 'unknown';

        try {
            // Get video title first
            let title = 'YouTube Video';
            try {
                const info = await this.getVideoInfo(request.url);
                title = info.title;
            } catch {
                // Ignore error, use default title
            }

            // Create database record
            await this.databaseService.sql`
                INSERT INTO youtube_downloads (id, video_id, title, format_type, quality, status, expires_at)
                VALUES (${id}, ${videoId}, ${title}, ${request.formatType}, ${request.quality}, 'processing', ${expiresAt})
            `;

            this.logger.log(`📥 Starting yt-dlp download: ${id} (${title})`);

            // Start async download
            this.processDownloadWithYtDlp(id, request);

            return {
                id,
                videoId,
                title,
                status: 'processing',
            };
        } catch (error) {
            this.logger.error(`Failed to start download: ${id}`, error);
            throw error;
        }
    }

    /**
     * Process download using yt-dlp
     */
    private async processDownloadWithYtDlp(id: string, request: DownloadRequest) {
        const tmpDir = os.tmpdir();
        const outputTemplate = path.join(tmpDir, `yt_${id}.%(ext)s`);

        try {
            let formatArg: string;
            let ext: string;

            if (request.formatType === 'audio') {
                // Audio only - extract to mp3
                formatArg = 'bestaudio';
                ext = 'mp3';
            } else {
                // Video with audio
                const height = request.quality.replace('p', '');
                formatArg = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
                ext = 'mp4';
            }

            // Build yt-dlp command with anti-bot measures
            const args = [
                '-f', formatArg,
                '-o', outputTemplate,
                '--no-playlist',
                '--no-warnings',
                // Anti-bot measures
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--extractor-args', 'youtube:player_client=web',
                '--no-check-certificates',
                '--retries', '3',
            ];

            if (request.formatType === 'audio') {
                args.push('-x', '--audio-format', 'mp3');
            } else {
                args.push('--merge-output-format', 'mp4');
            }

            args.push(request.url);

            this.logger.log(`🎬 Running yt-dlp with args: ${args.join(' ')}`);

            // Execute yt-dlp
            await new Promise<void>((resolve, reject) => {
                const proc = spawn(this.ytdlpPath, args);
                let stderr = '';

                proc.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderr += text;
                    // Parse progress from yt-dlp output
                    const progressMatch = text.match(/(\d+\.?\d*)%/);
                    if (progressMatch) {
                        const progress = Math.min(Math.floor(parseFloat(progressMatch[1])), 100);
                        this.progressMap.set(id, progress);
                    }
                });

                proc.stdout.on('data', (data) => {
                    const text = data.toString().trim();
                    this.logger.debug(`yt-dlp: ${text}`);
                    // Also check stdout for progress
                    const progressMatch = text.match(/(\d+\.?\d*)%/);
                    if (progressMatch) {
                        const progress = Math.min(Math.floor(parseFloat(progressMatch[1])), 100);
                        this.progressMap.set(id, progress);
                    }
                });

                proc.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                    }
                });

                proc.on('error', (err) => {
                    reject(err);
                });
            });

            // Find the downloaded file
            const expectedPath = path.join(tmpDir, `yt_${id}.${ext}`);
            let downloadedFile = expectedPath;

            // Check if file exists, if not try to find it
            if (!fs.existsSync(downloadedFile)) {
                const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(`yt_${id}`));
                if (files.length > 0) {
                    downloadedFile = path.join(tmpDir, files[0]);
                    ext = path.extname(files[0]).slice(1);
                } else {
                    throw new Error('Downloaded file not found');
                }
            }

            // Read file and upload to S3
            const buffer = fs.readFileSync(downloadedFile);
            const sanitizedTitle = (await this.getVideoTitle(id)) || 'video';
            const filename = `${sanitizedTitle.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 80)}.${ext}`;
            const objectKey = `youtube/${id}/${filename}`;
            const contentType = request.formatType === 'video' ? 'video/mp4' : 'audio/mpeg';

            await this.r2Service.uploadObject(objectKey, buffer, contentType);

            // Cleanup temp files (downloaded file + any player-script.js debug files)
            fs.unlinkSync(downloadedFile);
            this.cleanupTempFiles(tmpDir, id);

            // Update database
            await this.databaseService.sql`
                UPDATE youtube_downloads 
                SET status = 'completed', object_key = ${objectKey}, filename = ${filename}, file_size = ${buffer.length}
                WHERE id = ${id}
            `;

            this.logger.log(`✅ Download complete: ${id} (${buffer.length} bytes)`);
            // Cleanup progress map
            this.progressMap.delete(id);
        } catch (error) {
            this.logger.error(`❌ yt-dlp download failed: ${id}`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.databaseService.sql`
                UPDATE youtube_downloads SET status = 'failed', error = ${errorMessage} WHERE id = ${id}
            `;
            // Cleanup progress map
            this.progressMap.delete(id);
        }
    }

    /**
     * Cleanup temporary files created by yt-dlp
     */
    private cleanupTempFiles(tmpDir: string, id: string) {
        try {
            // Clean up any remaining yt_id.* files in temp dir
            const tempFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith(`yt_${id}`));
            for (const file of tempFiles) {
                try {
                    fs.unlinkSync(path.join(tmpDir, file));
                } catch { /* ignore */ }
            }

            // Clean up player-script.js files in cwd (yt-dlp creates these for debugging)
            const cwd = process.cwd();
            const playerScripts = fs.readdirSync(cwd).filter(f => f.includes('player-script.js'));
            for (const file of playerScripts) {
                try {
                    fs.unlinkSync(path.join(cwd, file));
                    this.logger.debug(`🧹 Cleaned up: ${file}`);
                } catch { /* ignore */ }
            }
        } catch (error) {
            this.logger.debug('Cleanup error (non-critical):', error);
        }
    }

    private async getVideoTitle(id: string): Promise<string | null> {
        const records = await this.databaseService.sql`
            SELECT title FROM youtube_downloads WHERE id = ${id}
        `;
        return records[0]?.title || null;
    }

    /**
     * Get download status
     */
    async getDownloadStatus(id: string): Promise<DownloadResult> {
        const records = await this.databaseService.sql`
            SELECT * FROM youtube_downloads WHERE id = ${id}
        `;

        if (records.length === 0) {
            throw new NotFoundException('Download not found');
        }

        const record = records[0];
        // Get live progress from memory map if processing
        const liveProgress = this.progressMap.get(id);

        return {
            id: record.id,
            videoId: record.video_id,
            title: record.title,
            status: record.status,
            progress: record.status === 'processing' ? (liveProgress || 0) : (record.status === 'completed' ? 100 : 0),
            fileSize: record.file_size ? parseInt(record.file_size) : undefined,
            filename: record.filename || undefined,
            downloadUrl: record.status === 'completed' ? `/youtube/${id}/file` : undefined,
            error: record.error || undefined,
        };
    }

    /**
     * Get downloaded file
     */
    async getDownloadedFile(id: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const records = await this.databaseService.sql`
            SELECT object_key, filename, format_type FROM youtube_downloads WHERE id = ${id} AND status = 'completed'
        `;

        if (records.length === 0) {
            throw new NotFoundException('File not found or not ready');
        }

        const record = records[0];
        const buffer = await this.r2Service.getObject(record.object_key);
        const contentType = record.format_type === 'video' ? 'video/mp4' : 'audio/mpeg';

        return { buffer, contentType, filename: record.filename || 'download' };
    }

    /**
     * Get expired downloads for cleanup
     */
    async getExpiredDownloads() {
        return this.databaseService.sql`
            SELECT id, object_key FROM youtube_downloads WHERE expires_at < NOW()
        `;
    }

    /**
     * Delete a download
     */
    async deleteDownload(id: string, objectKey: string) {
        if (objectKey) {
            await this.r2Service.deleteObject(objectKey);
        }
        await this.databaseService.sql`
            DELETE FROM youtube_downloads WHERE id = ${id}
        `;
    }
}
