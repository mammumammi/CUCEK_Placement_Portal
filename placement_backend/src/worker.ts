/**
 * @fileoverview Cloudflare Workers entry point.
 *
 * This module bootstraps the Express application using Cloudflare D1 as the
 * database backend instead of local SQLite.  It is used only when deploying
 * to Cloudflare Workers – local development still uses `src/server/index.ts`
 * with better-sqlite3.
 */

import { createD1Db } from './core/db/client';
import { createApp } from './server/app';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  NODE_ENV: string;
  GEMINI_API_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ---- Populate process.env so existing code (env.ts, etc.) keeps working ----
    if (env.JWT_SECRET) process.env.JWT_SECRET = env.JWT_SECRET;
    if (env.CORS_ORIGIN) process.env.CORS_ORIGIN = env.CORS_ORIGIN;
    process.env.DATABASE_URL = ':memory:'; // not used, but satisfies env validation
    if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;

    // ---- Create the Drizzle DB instance backed by D1 ----
    const db = createD1Db(env.DB);

    // ---- Build the Express app (same factory used in local dev) ----
    const app = createApp(db);

    // ---- Convert the incoming Workers Request → Node-style req/res ----
    return new Promise<Response>((resolve, reject) => {
      try {
        const url = new URL(request.url);

        // Collect headers
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const { ServerResponse } = require('node:http');
        const { Readable } = require('node:stream');

        // Create a readable stream from the request body
        const bodyStream = request.body
          ? Readable.fromWeb(request.body)
          : Readable.from([]);

        // Build a fake IncomingMessage
        const req = Object.assign(bodyStream, {
          method: request.method,
          url: url.pathname + url.search,
          headers,
          connection: { encrypted: url.protocol === 'https:' },
          socket: { remoteAddress: '127.0.0.1' },
        });

        // Build a ServerResponse that captures output into a Web Response
        const chunks: Buffer[] = [];
        const res = new ServerResponse(req);
        const originalWrite = res.write.bind(res);
        const originalEnd = res.end.bind(res);

        res.write = (chunk: any, ...args: any[]) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return originalWrite(chunk, ...args);
        };

        res.end = (chunk: any, ...args: any[]) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));

          const responseHeaders = new Headers();
          const rawHeaders = res.getHeaders();
          for (const [key, value] of Object.entries(rawHeaders)) {
            if (value !== undefined) {
              if (Array.isArray(value)) {
                value.forEach((v: string) => responseHeaders.append(key, v));
              } else {
                responseHeaders.set(key, String(value));
              }
            }
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: responseHeaders,
            })
          );

          return originalEnd(chunk, ...args);
        };

        // Let Express handle it
        app(req, res);
      } catch (err) {
        reject(err);
      }
    });
  },
};
