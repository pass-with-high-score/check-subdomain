import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProxyService } from './proxy.service';

@Module({
    imports: [DatabaseModule],
    providers: [ProxyService],
    exports: [ProxyService],
})
export class ProxyModule { }
