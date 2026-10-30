/**
 * @fileoverview Unified Domain Error System for the Placement Portal.
 * @module core/errors/portal-error
 *
 * Provides a standardized error class and error code taxonomy for handling
 * business rule violations, concurrency conflicts, authorization rejections,
 * and edge runtime constraints across Next.js and Cloudflare Workers.
 */

/**
 * Standard error codes denoting specific domain and infrastructure failure conditions.
 *
 * @remarks
 * - `FORBIDDEN`: The actor lacks sufficient RBAC privileges or branch-scope authorization
 *   for the requested resource (maps to HTTP 403).
 * - `ROW_LOCKED`: Optimistic lock conflict or concurrent modification occurred on a resource
 *   actively being processed or locked by a coordinator (maps to HTTP 423).
 * - `DEADLINE_EXPIRED`: The drive registration window or round submission cutoff timestamp
 *   has elapsed (maps to HTTP 410).
 * - `INELIGIBLE`: The student does not satisfy drive prerequisites (e.g., CGPA below cutoff,
 *   active backlogs present, unverified profile, or disqualified branch) (maps to HTTP 422).
 * - `VALIDATION_ERROR`: Input payload failed schema validation, format constraints, or integrity checks (maps to HTTP 400).
 * - `RATE_LIMITED`: The client exceeded the allowed request throughput threshold at the Cloudflare Edge (maps to HTTP 429).
 */
export type ErrorCode =
  | 'FORBIDDEN'
  | 'ROW_LOCKED'
  | 'DEADLINE_EXPIRED'
  | 'INELIGIBLE'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED';

/**
 * Default HTTP status code mapping associated with each {@link ErrorCode}.
 */
export const DEFAULT_STATUS_CODES: Readonly<Record<ErrorCode, number>> = {
  FORBIDDEN: 403,
  ROW_LOCKED: 423,
  DEADLINE_EXPIRED: 410,
  INELIGIBLE: 422,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
} as const;

/**
 * Serialized representation of a {@link PortalError} suitable for API JSON responses.
 */
export interface PortalErrorPayload {
  readonly success: false;
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly statusCode: number;
    readonly details?: unknown;
  };
}

/**
 * Optional configuration when instantiating a {@link PortalError}.
 */
export interface PortalErrorOptions extends ErrorOptions {
  /**
   * Additional structured diagnostic context, validation issue list, or debugging payload.
   */
  readonly details?: unknown;
  /**
   * Explicit HTTP status code override. If omitted, uses {@link DEFAULT_STATUS_CODES}.
   */
  readonly statusCode?: number;
}

/**
 * Domain error class representing operational and business exceptions within the Placement Portal.
 *
 * @remarks
 * Extends standard JavaScript `Error` with structured classification (`code`), an HTTP status
 * code (`statusCode`), and optional serializable metadata (`details`). Handled uniformly in Next.js
 * App Router route handlers, Server Actions, and Cloudflare Worker endpoints.
 *
 * @example
 * ```typescript
 * if (drive.registrationDeadline < new Date()) {
 *   throw PortalError.deadlineExpired(
 *     `Registration for drive "${drive.title}" closed on ${drive.registrationDeadline.toISOString()}`
 *   );
 * }
 * ```
 */
export class PortalError extends Error {
  /**
   * Machine-readable error code classifying the domain failure.
   */
  public readonly code: ErrorCode;

  /**
   * HTTP status code representation of the error.
   */
  public readonly statusCode: number;

  /**
   * Optional contextual metadata or field-level validation errors.
   */
  public readonly details?: unknown;

  /**
   * Creates a new instance of {@link PortalError}.
   *
   * @param code - The domain {@link ErrorCode} representing the failure condition.
   * @param message - Human-readable explanation of the error.
   * @param statusCode - Optional HTTP status code override. Defaults to standard code for the {@link ErrorCode}.
   * @param options - Additional error options including `cause` and `details`.
   */
  constructor(
    code: ErrorCode,
    message: string,
    statusCode?: number,
    options?: PortalErrorOptions
  ) {
    super(message, options);
    this.name = 'PortalError';
    this.code = code;
    this.statusCode = statusCode ?? options?.statusCode ?? DEFAULT_STATUS_CODES[code];
    this.details = options?.details;

    // Maintains proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PortalError);
    }
  }

  /**
   * Factory method creating a 403 Forbidden error.
   */
  public static forbidden(
    message = 'You do not have permission to perform this action.',
    details?: unknown
  ): PortalError {
    return new PortalError('FORBIDDEN', message, 403, { details });
  }

  /**
   * Factory method creating a 423 Locked / Concurrency conflict error.
   */
  public static rowLocked(
    message = 'The requested record is locked or currently being modified by another coordinator.',
    details?: unknown
  ): PortalError {
    return new PortalError('ROW_LOCKED', message, 423, { details });
  }

  /**
   * Factory method creating a 410 Gone / Deadline expired error.
   */
  public static deadlineExpired(
    message = 'The deadline for this action has passed and submissions are closed.',
    details?: unknown
  ): PortalError {
    return new PortalError('DEADLINE_EXPIRED', message, 410, { details });
  }

  /**
   * Factory method creating a 422 Ineligible student error.
   */
  public static ineligible(
    message = 'You do not meet the academic or departmental eligibility criteria for this drive.',
    details?: unknown
  ): PortalError {
    return new PortalError('INELIGIBLE', message, 422, { details });
  }

  /**
   * Factory method creating a 400 Bad Request / Validation error.
   */
  public static validationError(
    message = 'The submitted data failed validation constraints.',
    details?: unknown
  ): PortalError {
    return new PortalError('VALIDATION_ERROR', message, 400, { details });
  }

  /**
   * Factory method creating a 429 Too Many Requests / Rate limit error.
   */
  public static rateLimited(
    message = 'Rate limit exceeded. Please wait before retrying your request.',
    details?: unknown
  ): PortalError {
    return new PortalError('RATE_LIMITED', message, 429, { details });
  }

  /**
   * Serializes the error instance into a standardized JSON response envelope.
   */
  public toJSON(): PortalErrorPayload {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details !== undefined ? { details: this.details } : {}),
      },
    };
  }
}

/**
 * Type guard testing whether an unknown value is an instance of {@link PortalError}.
 *
 * @param error - The candidate error to evaluate.
 * @returns `true` if the candidate is a {@link PortalError}, otherwise `false`.
 */
export function isPortalError(error: unknown): error is PortalError {
  return (
    error instanceof PortalError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'statusCode' in error &&
      (error as { name?: string }).name === 'PortalError')
  );
}

