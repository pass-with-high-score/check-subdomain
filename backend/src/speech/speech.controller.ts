import {
    Controller,
    Post,
    Get,
    Param,
    Query,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Res,
    Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SpeechService, SpeechTranscription } from './speech.service';

@Controller('speech')
export class SpeechController {
    constructor(private readonly speechService: SpeechService) { }

    /**
     * Upload audio file
     */
    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
        fileFilter: (req, file, cb) => {
            const allowedMimes = [
                'audio/mpeg',
                'audio/mp3',
                'audio/wav',
                'audio/wave',
                'audio/ogg',
                'audio/webm',
                'audio/mp4',
                'audio/m4a',
                'audio/flac',
                'audio/x-m4a',
            ];
            if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|webm|m4a|flac)$/i)) {
                cb(null, true);
            } else {
                cb(new BadRequestException('Only audio files are allowed'), false);
            }
        },
    }))
    async uploadAudio(@UploadedFile() file: { originalname: string; buffer: Buffer; mimetype: string; size: number }): Promise<SpeechTranscription> {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }
        return this.speechService.uploadAudio(file);
    }

    /**
     * Start transcription
     */
    @Post(':id/transcribe')
    async transcribe(@Param('id') id: string, @Query('language') language?: string): Promise<SpeechTranscription> {
        return this.speechService.transcribe(id, language || 'vi');
    }

    /**
     * Get transcription result
     */
    @Get(':id')
    async getTranscription(@Param('id') id: string): Promise<SpeechTranscription> {
        return this.speechService.getTranscription(id);
    }

    /**
     * Stream audio file with Range request support for seeking
     */
    @Get(':id/audio')
    async streamAudio(
        @Param('id') id: string,
        @Headers('range') range: string | undefined,
        @Res() res: Response,
    ): Promise<void> {
        const { buffer, contentType } = await this.speechService.getAudioFile(id);
        const fileSize = buffer.length;

        // Handle Range requests for seeking
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
            });
            res.end(buffer.subarray(start, end + 1));
        } else {
            // No range - return full file
            res.set({
                'Accept-Ranges': 'bytes',
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Content-Disposition': 'inline',
            });
            res.end(buffer);
        }
    }
}

