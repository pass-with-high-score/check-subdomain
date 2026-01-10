import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);

    logger.log(`🚀 Cleanup backend is running on port ${port}`);
    logger.log(`📅 Scheduled cleanup task will run every hour`);
}
bootstrap();
