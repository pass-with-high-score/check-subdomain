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
     * Redirect to presigned URL for direct download from R2
     */
    @Get(':id/file')
    async downloadFile(
        @Param('id') id: string,
        @Res() res: Response,
    ): Promise<void> {
        const downloadUrl = await this.youtubeService.getDownloadUrl(id);
        res.redirect(302, downloadUrl);
    }
}
