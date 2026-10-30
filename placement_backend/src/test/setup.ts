/**
 * @fileoverview Vitest global setup file configuring environment variables for tests.
 * @module test/setup
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-key';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.DATABASE_URL = ':memory:';
process.env.PORT = '4000';

