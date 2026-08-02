import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Dahua ITSAPI ingestion routes stay outside /api/v1: the camera firmware
  // only lets you configure a base server URL, and appends fixed ITSAPI
  // suffixes (/NotificationInfo/...) that are not versionable like the rest
  // of the administrative API — see DAHUA_IMPLEMENTATION_PLAN.md §0/§1.
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'integrations/dahua/(.*)', method: RequestMethod.ALL }],
  });

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultDevOrigins = ['http://localhost:5173', 'http://localhost:3000'];
  const corsOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : defaultDevOrigins;

  if (configuredOrigins.length === 0) {
    console.warn(
      'CORS_ORIGINS is not set. Falling back to local dev origins ' +
        `(${defaultDevOrigins.join(', ')}). Set CORS_ORIGINS in any ` +
        'deployed environment (comma-separated) or requests from the real ' +
        'frontend origin will be rejected.',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Smart City Parking API')
    .setDescription('Enterprise multi-tenant Smart City Parking platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger running on http://localhost:${port}/docs`);
}

bootstrap();
