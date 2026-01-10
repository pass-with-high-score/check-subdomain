import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { SpeechController } from './speech.controller';
import { SpeechService } from './speech.service';

@Module({
    imports: [DatabaseModule, StorageModule],
    controllers: [SpeechController],
    providers: [SpeechService],
})
export class SpeechModule { }
