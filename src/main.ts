import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as compression from 'compression';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Security
  app.use(helmet());
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Payload size limit
  app.use((req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 1024 * 1024; // 1MB

    if (contentLength > maxSize) {
      return res.status(413).json({
        statusCode: 413,
        message: 'Payload too large',
      });
    }

    next();
  });

  app.enableCors();

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Health check: http://localhost:${port}/api/v1/health`);
}

bootstrap();
