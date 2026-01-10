import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Param,
    Res,
    Headers,
    BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { DownloadRequest, DownloadResult, VideoInfo, YouTubeService } from './youtube.service';


@Controller('youtube')
export class YouTubeController {
    constructor(private readonly youtubeService: YouTubeService) { }

    /**
     * Get video information from YouTube URL
     */
    @Get('info')
    async getVideoInfo(@Query('url') url: string): Promise<VideoInfo> {
        if (!url) {
            throw new BadRequestException('URL is required');
        }
        return this.youtubeService.getVideoInfo(url);
    }

    /**
     * Start download with selected format
     */
    @Post('download')
    async startDownload(@Body() request: DownloadRequest): Promise<DownloadResult> {
        if (!request.url) {
            throw new BadRequestException('URL is required');
        }
        if (!request.formatType || !['video', 'audio'].includes(request.formatType)) {
            throw new BadRequestException('formatType must be "video" or "audio"');
        }
        if (!request.quality) {
            throw new BadRequestException('quality is required');
        }
        return this.youtubeService.startDownload(request);
    }

    /**
     * Get download status
     */
    @Get(':id')
    async getDownloadStatus(@Param('id') id: string): Promise<DownloadResult> {
        return this.youtubeService.getDownloadStatus(id);
    }

    /**
     * Stream downloaded file with Range support
     */
    @Get(':id/file')
    async streamFile(
        @Param('id') id: string,
        @Headers('range') range: string | undefined,
        @Res() res: Response,
    ): Promise<void> {
        const { buffer, contentType, filename } = await this.youtubeService.getDownloadedFile(id);
        const fileSize = buffer.length;

        // Set filename for download
        const encodedFilename = encodeURIComponent(filename);

        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            res.status(206);
            res.set({
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
            });
            res.end(buffer.subarray(start, end + 1));
        } else {
            res.set({
                'Accept-Ranges': 'bytes',
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
            });
            res.end(buffer);
        }
    }
}
