import { existsSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadConfig } from './shared/config/app-config.js';

// Local development reads backend/.env (Node 24 built-in); deployments inject real env vars.
if (existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig(process.env);
const app = configureApp(await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true }));
await app.listen(config.port);
