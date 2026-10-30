/**
 * @fileoverview Integration tests for Express application foundation.
 * @module server/app.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app';
import { createTestDb } from '@/test/test-db';
import { env } from './config/env';

describe('Server Application Foundation', () => {
  let app: Express;

  beforeEach(() => {
    const db = createTestDb();
    app = createApp(db);
  });

  it('GET /api/health returns 200 { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('handles unknown routes with a 404 JSON response and standardized error shape', async () => {
    const res = await request(app).get('/api/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('configures CORS to allow credentials for configured CORS_ORIGIN', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', env.CORS_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('handles CORS preflight OPTIONS request with credentials allowed', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', env.CORS_ORIGIN)
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(env.CORS_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});

