/**
 * Harmonia Backend Server
 *
 * NestJS application entry point with:
 * - Global validation pipe for DTO validation
 * - CORS enabled for frontend communication
 * - API prefix `/api` for all routes
 * - Swagger/OpenAPI documentation
 * - Environment-based configuration
 */

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('Harmonia API')
    .setDescription('Comprehensive API for Harmonia Music Generation Platform')
    .setVersion('1.0.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('songs', 'Song generation and management')
    .addTag('health', 'Health check endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  // Global API prefix
  const globalPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(globalPrefix);

  // Enable CORS for frontend
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    credentials: true,
  });

  // Global validation pipe for DTO validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error for non-whitelisted properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable type coercion
      },
    })
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(`📚 Swagger docs available at: http://localhost:${port}/api/docs`);
  Logger.log(
    `📚 Auth endpoints: http://localhost:${port}/${globalPrefix}/auth`
  );
}

bootstrap();
