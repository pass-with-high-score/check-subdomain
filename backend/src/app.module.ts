import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { ChatModule } from './chat/chat.module';
import { SpeechModule } from './speech/speech.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        ScheduleModule.forRoot(),
        DatabaseModule,
        StorageModule,
        CleanupModule,
        ChatModule,
        SpeechModule,
    ],
})
export class AppModule { }

