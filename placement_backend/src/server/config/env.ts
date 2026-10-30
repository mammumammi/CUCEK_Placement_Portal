/**
 * @fileoverview Environment configuration loader and Zod validation schema.
 * @module server/config/env
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

/**
 * Zod schema defining required and defaulted environment variables.
 */
export const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().default('./placement.db'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated runtime environment variables.
 * Throws a formatted ZodError if validation fails.
 */
export const env: Env = envSchema.parse(process.env);

