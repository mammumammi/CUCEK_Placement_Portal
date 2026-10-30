/**
 * @fileoverview Unified Domain Error System for the Placement Portal Backend.
 * @module core/errors/portal-error
 */

export type ErrorCode =
  | 'FORBIDDEN'
  | 'ROW_LOCKED'
  | 'DEADLINE_EXPIRED'
  | 'INELIGIBLE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INTERNAL_ERROR';

export const DEFAULT_STATUS_CODES: Readonly<Record<ErrorCode, number>> = {
  FORBIDDEN: 403,
  ROW_LOCKED: 423,
  DEADLINE_EXPIRED: 410,
  INELIGIBLE: 422,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
} as const;

export interface PortalErrorPayload {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
  };
}

export class PortalError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;

  constructor(code: ErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'PortalError';
    this.code = code;
    this.statusCode = statusCode ?? DEFAULT_STATUS_CODES[code] ?? 500;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): PortalErrorPayload {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}

export function isPortalError(error: unknown): error is PortalError {
  return error instanceof PortalError;
}

