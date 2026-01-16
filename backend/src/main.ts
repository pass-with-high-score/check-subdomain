import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/logging.interceptor';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    // Enable CORS with explicit configuration
    app.enableCors({
        origin: true, // Reflect the request origin (more compatible than '*')
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
        exposedHeaders: ['Content-Length', 'Content-Type'],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204,
    });

    // Global logging interceptor
    app.useGlobalInterceptors(new LoggingInterceptor());

    const port = process.env.PORT || 3010;
    console.log(`🚀 Cleanup backend is running on port ${port}`);
    await app.listen(port);

    logger.log(`📅 Scheduled cleanup task will run every hour`);
}
bootstrap();
