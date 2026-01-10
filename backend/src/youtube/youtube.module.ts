import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { YouTubeController } from './youtube.controller';
import { YouTubeService } from './youtube.service';

@Module({
    imports: [DatabaseModule, StorageModule],
    controllers: [YouTubeController],
    providers: [YouTubeService],
    exports: [YouTubeService],
})
export class YouTubeModule { }
