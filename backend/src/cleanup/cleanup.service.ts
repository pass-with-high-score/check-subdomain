import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';
import { R2Service } from '../storage/r2.service';

@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(
        private readonly databaseService: DatabaseService,
        private readonly r2Service: R2Service,
    ) { }

    /**
     * Cleanup expired file transfers - runs every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleTransferCleanup() {
        this.logger.log('🧹 Starting file transfer cleanup...');

        try {
            // Find expired transfers
            const expiredTransfers = await this.databaseService.getExpiredTransfers();

            if (expiredTransfers.length === 0) {
                this.logger.log('✅ No expired transfers found');
                return;
            }

            let deleted = 0;
            let failed = 0;

            for (const transfer of expiredTransfers) {
                try {
                    // Delete from R2
                    await this.r2Service.deleteObject(transfer.object_key);

                    // Delete from database
                    await this.databaseService.deleteTransfer(transfer.id);

                    deleted++;
                    this.logger.debug(`Deleted transfer: ${transfer.id} (${transfer.filename})`);
                } catch (error) {
                    this.logger.error(`Failed to delete transfer ${transfer.id}:`, error);
                    failed++;
                }
            }

            this.logger.log(`✅ Cleanup complete: ${deleted} deleted, ${failed} failed`);
        } catch (error) {
            this.logger.error('❌ Cleanup task failed:', error);
        }
    }

    /**
     * Cleanup old webhook endpoints - runs daily at midnight
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleWebhookCleanup() {
        this.logger.log('🧹 Starting webhook endpoint cleanup...');

        try {
            const deletedCount = await this.databaseService.cleanupOldEndpoints();
            this.logger.log(`✅ Deleted ${deletedCount} old webhook endpoints`);
        } catch (error) {
            this.logger.error('❌ Webhook cleanup failed:', error);
        }
    }

    /**
     * Cleanup expired JSON bins - runs every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleJsonBinCleanup() {
        this.logger.log('🧹 Starting JSON bin cleanup...');

        try {
            const deletedCount = await this.databaseService.cleanupExpiredJsonBins();
            this.logger.log(`✅ Deleted ${deletedCount} expired JSON bins`);
        } catch (error) {
            this.logger.error('❌ JSON bin cleanup failed:', error);
        }
    }

    /**
     * Cleanup expired speech transcriptions - runs every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleSpeechCleanup() {
        this.logger.log('🧹 Starting speech transcription cleanup...');

        try {
            const expiredSpeech = await this.databaseService.getExpiredSpeechTranscriptions();

            if (expiredSpeech.length === 0) {
                this.logger.log('✅ No expired speech transcriptions found');
                return;
            }

            let deleted = 0;
            let failed = 0;

            for (const speech of expiredSpeech) {
                try {
                    await this.r2Service.deleteObject(speech.object_key);
                    await this.databaseService.deleteSpeechTranscription(speech.id);
                    deleted++;
                } catch (error) {
                    this.logger.error(`Failed to delete speech ${speech.id}:`, error);
                    failed++;
                }
            }

            this.logger.log(`✅ Speech cleanup complete: ${deleted} deleted, ${failed} failed`);
        } catch (error) {
            this.logger.error('❌ Speech cleanup failed:', error);
        }
    }

    /**
     * Cleanup expired YouTube downloads - runs every hour
     */
    @Cron(CronExpression.EVERY_HOUR)
    async handleYouTubeCleanup() {
        this.logger.log('🧹 Starting YouTube downloads cleanup...');

        try {
            const expiredDownloads = await this.databaseService.getExpiredYouTubeDownloads();

            if (expiredDownloads.length === 0) {
                this.logger.log('✅ No expired YouTube downloads found');
                return;
            }

            let deleted = 0;
            let failed = 0;

            for (const download of expiredDownloads) {
                try {
                    if (download.object_key) {
                        await this.r2Service.deleteObject(download.object_key);
                    }
                    await this.databaseService.deleteYouTubeDownload(download.id);
                    deleted++;
                } catch (error) {
                    this.logger.error(`Failed to delete YouTube download ${download.id}:`, error);
                    failed++;
                }
            }

            this.logger.log(`✅ YouTube cleanup complete: ${deleted} deleted, ${failed} failed`);
        } catch (error) {
            this.logger.error('❌ YouTube cleanup failed:', error);
        }
    }
}

