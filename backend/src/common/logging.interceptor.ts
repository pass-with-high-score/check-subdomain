import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const ctx = context.switchToHttp();
        const request = ctx.getRequest<Request>();
        const response = ctx.getResponse<Response>();

        const { method, url, ip } = request;
        const userAgent = request.get('user-agent') || '';
        const now = Date.now();

        // Log incoming request
        this.logger.log(`➡️ ${method} ${url} - ${ip} - ${userAgent.substring(0, 50)}...`);

        return next.handle().pipe(
            tap({
                next: () => {
                    const duration = Date.now() - now;
                    const statusCode = response.statusCode;
                    this.logger.log(`⬅️ ${method} ${url} ${statusCode} - ${duration}ms`);
                },
                error: (error) => {
                    const duration = Date.now() - now;
                    const statusCode = error.status || 500;
                    this.logger.error(`❌ ${method} ${url} ${statusCode} - ${duration}ms - ${error.message}`);
                },
            }),
        );
    }
}
