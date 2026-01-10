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
    filesize?: number; // Estimated file size in bytes
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
    outputFormat?: string; // video: mp4, webm, mkv | audio: mp3, m4a, opus, flac, wav
    startTime?: string; // Optional: clip start time (seconds or mm:ss)
    endTime?: string;   // Optional: clip end time (seconds or mm:ss)
}

export interface DownloadResult {
    id: string;
    videoId: string;
    title: string;
    status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed';
    progress?: number;
    downloadUrl?: string;
    fileSize?: number;
    filename?: string;
    error?: string;
    queuePosition?: number;
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
        filesize_approx?: number;
    }>;
}

interface QueuedDownload {
    id: string;
    request: DownloadRequest;
    title: string;
}

@Injectable()
export class YouTubeService implements OnModuleInit {
    private readonly logger = new Logger(YouTubeService.name);
    private ytdlpPath = 'yt-dlp';
    private cookiesPath: string | null = null;
    // In-memory progress tracking (faster than DB updates)
    private progressMap = new Map<string, number>();

    // Download queue system
    private readonly MAX_CONCURRENT_DOWNLOADS = 3;
    private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB limit
    private activeDownloads = 0;
    private downloadQueue: QueuedDownload[] = [];

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly r2Service: R2Service,
    ) { }

    async onModuleInit() {
        await this.initTable();
        this.checkYtDlp();
        this.checkCookies();
    }

    private checkYtDlp() {
        // Try common paths for yt-dlp
        const possiblePaths = [
            'yt-dlp',  // In PATH
            `${process.env.HOME}/.local/bin/yt-dlp`,  // pip user install
            '/usr/local/bin/yt-dlp',  // Homebrew/manual install
            '/usr/bin/yt-dlp',  // apt install
        ];

        for (const ytPath of possiblePaths) {
            try {
                const version = execSync(`${ytPath} --version`, { encoding: 'utf-8' }).trim();
                this.ytdlpPath = ytPath;
                this.logger.log(`📺 yt-dlp found at ${ytPath}, version: ${version}`);
                return;
            } catch {
                // Try next path
            }
        }
        this.logger.warn('⚠️ yt-dlp not found. YouTube downloads will not work.');
    }

    private checkCookies() {
        // Check for cookies file from env or default path
        const cookiesFile = process.env.YOUTUBE_COOKIES_PATH || './youtube-cookies.txt';
        if (fs.existsSync(cookiesFile)) {
            this.cookiesPath = cookiesFile;
            this.logger.log(`🍪 YouTube cookies loaded from: ${cookiesFile}`);
        } else {
            this.logger.log('ℹ️ No YouTube cookies file found. Some videos may be blocked.');
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
            // Build yt-dlp arguments for getting video info
            const args: string[] = [
                '-j',                   // Output JSON
                '--no-download',        // Don't download, just get info
                '--no-warnings',        // Suppress warnings
                '--no-check-certificates',
            ];

            // Add cookies if available
            if (this.cookiesPath) {
                args.push('--cookies', this.cookiesPath);
            }

            // Anti-bot measures with bun runtime
            args.push(
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--no-js-runtimes',     // Disable default deno first
                '--js-runtimes', 'bun', // Enable bun runtime
            );

            args.push(url);

            // Build command string
            const command = `${this.ytdlpPath} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;

            this.logger.log(`🔍 Getting video info for: ${videoId}`);
            this.logger.debug(`📋 Command: ${command}`);

            const result = execSync(command, {
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024,
            });

            this.logger.log(`✅ Video info retrieved successfully for: ${videoId}`);

            const info: YtDlpVideoInfo = JSON.parse(result);

            // Parse available video formats from yt-dlp response
            const heightToFilesize = new Map<number, number>();
            const bitrateToFilesize = new Map<number, number>();

            for (const format of info.formats || []) {
                // Video formats: has height and video codec
                if (format.height && format.vcodec && format.vcodec !== 'none') {
                    const existingSize = heightToFilesize.get(format.height) || 0;
                    const formatSize = format.filesize || format.filesize_approx || 0;
                    if (formatSize > existingSize) {
                        heightToFilesize.set(format.height, formatSize);
                    }
                }
                // Audio formats: has audio codec and bitrate
                if (format.acodec && format.acodec !== 'none' && format.abr) {
                    const bitrate = Math.round(format.abr);
                    const existingSize = bitrateToFilesize.get(bitrate) || 0;
                    const formatSize = format.filesize || format.filesize_approx || 0;
                    if (formatSize > existingSize) {
                        bitrateToFilesize.set(bitrate, formatSize);
                    }
                }
            }

            // Get best audio size to add to video sizes
            const bestAudioSize = Math.max(...bitrateToFilesize.values(), 0);

            // Build video format options from available heights
            const standardHeights = [2160, 1440, 1080, 720, 480, 360, 240, 144];
            const videoFormats: FormatOption[] = standardHeights
                .filter(h => heightToFilesize.has(h) || [...heightToFilesize.keys()].some(ah => ah >= h))
                .slice(0, 5) // Max 5 options
                .map(h => {
                    // Get filesize for this height, or find closest higher resolution
                    let filesize = heightToFilesize.get(h) || 0;
                    if (!filesize) {
                        const higherRes = [...heightToFilesize.entries()].find(([hh]) => hh >= h);
                        filesize = higherRes ? higherRes[1] : 0;
                    }
                    // Add audio size for video+audio combined estimate
                    const totalSize = filesize + bestAudioSize;
                    return {
                        quality: h >= 2160 ? '4K' : h >= 1440 ? '2K' : `${h}p`,
                        value: String(h),
                        filesize: totalSize > 0 ? totalSize : undefined,
                    };
                });

            // Fallback if no video formats found
            if (videoFormats.length === 0) {
                videoFormats.push({ quality: 'Best', value: 'bestvideo' });
            }

            // Build audio format options
            const audioFormats: FormatOption[] = [
                { quality: 'Best', value: 'bestaudio', filesize: bestAudioSize > 0 ? bestAudioSize : undefined },
            ];

            // Add specific bitrate options if available
            const sortedBitrates = [...bitrateToFilesize.keys()].sort((a, b) => b - a);
            for (const bitrate of sortedBitrates.slice(0, 3)) {
                if (bitrate >= 64) {
                    audioFormats.push({
                        quality: `${bitrate}kbps`,
                        value: String(bitrate),
                        filesize: bitrateToFilesize.get(bitrate),
                    });
                }
            }

            this.logger.log(`📊 [${videoId}] Available: ${videoFormats.length} video, ${audioFormats.length} audio formats`);

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
     * Start download using yt-dlp with queue management
     */
    async startDownload(request: DownloadRequest): Promise<DownloadResult> {
        const id = this.generateId();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        const videoId = this.extractVideoId(request.url) || 'unknown';

        try {
            // Get video info first
            let title = 'YouTube Video';
            let duration = 0;
            try {
                const info = await this.getVideoInfo(request.url);
                title = info.title;
                duration = info.duration;
            } catch {
                // Ignore error, use default title
            }

            // Estimate file size based on duration and quality
            // Average bitrates: 1080p ~5Mbps, 720p ~2.5Mbps, 480p ~1Mbps, audio ~128kbps
            if (duration > 0) {
                // For clip mode: still check FULL video size since we download entire video first
                // This prevents trying to clip from very large videos
                const isClipMode = !!(request.startTime || request.endTime);

                let estimatedBitrate = 1000; // 1 Mbps default
                if (request.formatType === 'video') {
                    const height = parseInt(request.quality.replace('p', '')) || 720;
                    if (height >= 1080) estimatedBitrate = 5000;
                    else if (height >= 720) estimatedBitrate = 2500;
                    else if (height >= 480) estimatedBitrate = 1000;
                    else estimatedBitrate = 500;
                } else {
                    estimatedBitrate = 128; // Audio only
                }

                // For clip mode, check full video size; for normal mode, check requested duration
                const estimatedSize = (duration * estimatedBitrate * 1000) / 8; // bytes
                if (estimatedSize > this.MAX_FILE_SIZE) {
                    const sizeMB = Math.round(estimatedSize / 1024 / 1024);
                    const maxMB = Math.round(this.MAX_FILE_SIZE / 1024 / 1024);
                    this.logger.warn(`⚠️ Video too large: ~${sizeMB}MB (max ${maxMB}MB) - ${title}`);
                    if (isClipMode) {
                        throw new BadRequestException(
                            `Full video is too large (~${sizeMB}MB). Clip mode still downloads the entire video first. Maximum allowed is ${maxMB}MB. Try a shorter source video.`
                        );
                    } else {
                        throw new BadRequestException(
                            `Video is too large (~${sizeMB}MB). Maximum allowed size is ${maxMB}MB. Try a lower quality or shorter video.`
                        );
                    }
                }
            }

            // Check if we need to queue or can start immediately
            if (this.activeDownloads >= this.MAX_CONCURRENT_DOWNLOADS) {
                // Queue the download
                this.downloadQueue.push({ id, request, title });
                const queuePosition = this.downloadQueue.length;

                this.logger.log(`⏳ [${id}] Queued download (position ${queuePosition}): ${title}`);

                // Create database record with 'queued' status
                await this.databaseService.sql`
                    INSERT INTO youtube_downloads (id, video_id, title, format_type, quality, status, expires_at)
                    VALUES (${id}, ${videoId}, ${title}, ${request.formatType}, ${request.quality}, 'queued', ${expiresAt})
                `;

                return {
                    id,
                    videoId,
                    title,
                    status: 'queued',
                    queuePosition,
                };
            }

            // Start immediately
            this.activeDownloads++;
            this.logger.log(`📥 [${id}] Starting download (${this.activeDownloads}/${this.MAX_CONCURRENT_DOWNLOADS} active): ${title}`);

            // Create database record
            await this.databaseService.sql`
                INSERT INTO youtube_downloads (id, video_id, title, format_type, quality, status, expires_at)
                VALUES (${id}, ${videoId}, ${title}, ${request.formatType}, ${request.quality}, 'processing', ${expiresAt})
            `;

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
     * Process next item in the download queue
     */
    private async processNextInQueue() {
        if (this.downloadQueue.length === 0 || this.activeDownloads >= this.MAX_CONCURRENT_DOWNLOADS) {
            return;
        }

        const next = this.downloadQueue.shift();
        if (!next) return;

        this.activeDownloads++;
        this.logger.log(`📥 [${next.id}] Starting queued download (${this.activeDownloads}/${this.MAX_CONCURRENT_DOWNLOADS} active): ${next.title}`);

        // Update status in database
        await this.databaseService.sql`
            UPDATE youtube_downloads SET status = 'processing' WHERE id = ${next.id}
        `;

        // Start the download
        this.processDownloadWithYtDlp(next.id, next.request);

        // Log remaining queue
        if (this.downloadQueue.length > 0) {
            this.logger.log(`📋 Queue: ${this.downloadQueue.length} remaining`);
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
            const outputFormat = request.outputFormat || (request.formatType === 'video' ? 'mp4' : 'mp3');

            if (request.formatType === 'audio') {
                // Audio only - extract to specified format
                formatArg = 'bestaudio';
                ext = outputFormat;
            } else {
                // Video with audio
                const height = request.quality.replace('p', '');

                // Choose format arg based on output format
                if (outputFormat === 'webm') {
                    // For WebM, prefer VP9 codec
                    formatArg = `bestvideo[height<=${height}][vcodec^=vp9]+bestaudio[acodec^=opus]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
                } else {
                    // For MP4/MKV, prefer H.264 (avc1) for max compatibility
                    formatArg = `bestvideo[height<=${height}][vcodec^=avc1]+bestaudio/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
                }
                ext = outputFormat;
            }

            // Build yt-dlp command with bun runtime
            const args = [
                '-f', formatArg,
                '-o', outputTemplate,
                '--no-playlist',
                '--no-warnings',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--no-js-runtimes',
                '--js-runtimes', 'bun',
                '--no-check-certificates',
                '--retries', '3',
            ];

            // Add cookies if available
            if (this.cookiesPath) {
                args.push('--cookies', this.cookiesPath);
            }

            // Add format-specific options
            if (request.formatType === 'audio') {
                args.push('-x');
                // Audio format options
                switch (outputFormat) {
                    case 'm4a':
                        args.push('--audio-format', 'aac');
                        break;
                    case 'opus':
                        args.push('--audio-format', 'opus');
                        break;
                    case 'flac':
                        args.push('--audio-format', 'flac');
                        break;
                    case 'wav':
                        args.push('--audio-format', 'wav');
                        break;
                    case 'mp3':
                    default:
                        args.push('--audio-format', 'mp3');
                        break;
                }
            } else {
                // Video format options
                args.push('--merge-output-format', outputFormat);
            }

            // Add clip download using --download-sections
            // Note: For long videos this will be slow as it streams from start
            if (request.startTime || request.endTime) {
                const start = request.startTime || '0';
                const end = request.endTime || 'inf';
                args.push('--download-sections', `*${start}-${end}`);
                this.logger.log(`✂️ [${id}] Clip mode: ${start} to ${end}`);
            }

            args.push(request.url);

            // Log the full command for debugging
            const commandString = `${this.ytdlpPath} ${args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ')}`;
            this.logger.log(`🎬 [${id}] Starting download: ${request.formatType} @ ${request.quality}`);
            this.logger.log(`📋 [${id}] Output: ${outputTemplate}`);
            this.logger.debug(`📋 [${id}] Command: ${commandString}`);

            // Execute yt-dlp
            await new Promise<void>((resolve, reject) => {
                const proc = spawn(this.ytdlpPath, args);
                let stderr = '';
                let lastLoggedProgress = -1;

                this.logger.log(`🚀 [${id}] yt-dlp process started (PID: ${proc.pid})`);

                proc.stderr.on('data', (data) => {
                    const text = data.toString();
                    stderr += text;

                    // Log important yt-dlp messages
                    if (text.includes('[download]') || text.includes('[merger]') || text.includes('[ExtractAudio]')) {
                        this.logger.debug(`📥 [${id}] ${text.trim()}`);
                    }

                    // Parse progress from yt-dlp output
                    const progressMatch = text.match(/(\d+\.?\d*)%/);
                    if (progressMatch) {
                        const progress = Math.min(Math.floor(parseFloat(progressMatch[1])), 100);
                        this.progressMap.set(id, progress);

                        // Log every 25% progress
                        if (progress >= lastLoggedProgress + 25) {
                            this.logger.log(`📊 [${id}] Progress: ${progress}%`);
                            lastLoggedProgress = progress;
                        }
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
                        this.logger.log(`✅ [${id}] yt-dlp process completed successfully`);
                        resolve();
                    } else {
                        this.logger.error(`❌ [${id}] yt-dlp exited with code ${code}`);
                        this.logger.error(`❌ [${id}] stderr: ${stderr.slice(-500)}`);
                        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
                    }
                });

                proc.on('error', (err) => {
                    this.logger.error(`❌ [${id}] yt-dlp process error: ${err.message}`);
                    reject(err);
                });
            });

            // Find the downloaded file
            this.logger.log(`🔍 [${id}] Looking for downloaded file...`);
            const expectedPath = path.join(tmpDir, `yt_${id}.${ext}`);
            let downloadedFile = expectedPath;

            // Check if file exists, if not try to find it
            if (!fs.existsSync(downloadedFile)) {
                const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(`yt_${id}`));
                if (files.length > 0) {
                    downloadedFile = path.join(tmpDir, files[0]);
                    ext = path.extname(files[0]).slice(1);
                    this.logger.log(`📁 [${id}] Found file: ${files[0]}`);
                } else {
                    throw new Error('Downloaded file not found');
                }
            } else {
                this.logger.log(`📁 [${id}] Found file at expected path`);
            }

            // Upload to R2 using streaming (memory efficient)
            const sanitizedTitle = (await this.getVideoTitle(id)) || 'video';
            const filename = `${sanitizedTitle.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 80)}.${ext}`;
            const objectKey = `youtube/${id}/${filename}`;

            // Get content type based on extension
            const contentTypeMap: Record<string, string> = {
                // Video
                mp4: 'video/mp4',
                webm: 'video/webm',
                mkv: 'video/x-matroska',
                // Audio
                mp3: 'audio/mpeg',
                m4a: 'audio/mp4',
                opus: 'audio/opus',
                flac: 'audio/flac',
                wav: 'audio/wav',
            };
            const contentType = contentTypeMap[ext] || (request.formatType === 'video' ? 'video/mp4' : 'audio/mpeg');

            this.logger.log(`☁️ [${id}] Uploading to R2 (streaming)...`);
            const fileSize = await this.r2Service.uploadObjectFromFile(objectKey, downloadedFile, contentType);
            this.logger.log(`☁️ [${id}] Upload complete!`);

            // Cleanup temp files (downloaded file + any player-script.js debug files)
            fs.unlinkSync(downloadedFile);
            this.cleanupTempFiles(tmpDir, id);

            // Update database
            await this.databaseService.sql`
                UPDATE youtube_downloads 
                SET status = 'completed', object_key = ${objectKey}, filename = ${filename}, file_size = ${fileSize}
                WHERE id = ${id}
            `;

            this.logger.log(`🎉 [${id}] Download complete: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
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
        } finally {
            // Always decrement active downloads and process next in queue
            this.activeDownloads--;
            this.logger.log(`📊 Active downloads: ${this.activeDownloads}/${this.MAX_CONCURRENT_DOWNLOADS}`);
            this.processNextInQueue();
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

        // Calculate queue position for queued downloads
        let queuePosition: number | undefined;
        if (record.status === 'queued') {
            const queueIndex = this.downloadQueue.findIndex(q => q.id === id);
            queuePosition = queueIndex >= 0 ? queueIndex + 1 : undefined;
        }

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
            queuePosition,
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
