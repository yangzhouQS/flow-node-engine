import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 启用CORS
  app.enableCors();

  // API 前缀
  app.setGlobalPrefix('api/v1');

  // Swagger 文档配置 - 必须在 setGlobalPrefix 之后、listen 之前配置
  try {
    const config = new DocumentBuilder()
      .setTitle('Flow Node Engine API')
      .setDescription('A complete workflow engine implemented with Node.js + NestJS + MySQL')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    // ignoreGlobalPrefix: true 使 Swagger UI 不受全局前缀影响
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
      },
      customSiteTitle: 'Flow Node Engine API Docs',
    });
    console.log('Swagger documentation initialized successfully');
  } catch (error) {
    console.warn('Swagger documentation initialization failed:', error);
    console.warn('Application will continue without Swagger documentation');
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation is available at: http://localhost:${port}/api-docs`);
}

bootstrap();
