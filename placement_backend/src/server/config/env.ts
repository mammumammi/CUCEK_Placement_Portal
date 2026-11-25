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
    .min(32, 'JWT_SECRET must be at least 32 characters long')
    .default('super-secret-default-jwt-key-minimum-32-chars-long'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_CREDENTIALS: z.string().optional(),
  MAPPING_MODEL: z.string().default('gemini-flash-lite-latest'),
});

export type Env = z.infer<typeof envSchema>;

const baseEnv: Env = envSchema.parse(process.env);

/**
 * Validated runtime environment variables proxy.
 * Checks process.env at runtime first, falling back to parsed defaults.
 */
export const env: Env = new Proxy(baseEnv, {
  get(target, prop: string | symbol) {
    if (typeof prop === 'string') {
      const val = process.env[prop];
      if (val !== undefined && val !== '') {
        return val;
      }
    }
    return (target as any)[prop];
  },
});

