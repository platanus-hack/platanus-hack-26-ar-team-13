import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '50mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.PORT ?? '3000';
  await app.listen(port, '0.0.0.0');
  console.log(`Claude Security Monitor listening on port ${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
