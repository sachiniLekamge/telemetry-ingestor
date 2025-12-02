import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

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

  app.use((req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 1024 * 1024;

    if (contentLength > maxSize) {
      return res.status(413).json({
        statusCode: 413,
        message: 'Payload too large',
      });
    }

    next();
  });

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

bootstrap();
