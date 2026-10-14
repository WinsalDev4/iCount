import { STATUS_CODES } from 'node:http';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError, type DomainErrorKind } from '../../domain/domain-error.js';
import { PROBLEM_JSON, type ProblemDetails, problemType } from './problem-details.js';
import { RequestValidationError } from './request-validation.error.js';

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  invalid: HttpStatus.UNPROCESSABLE_ENTITY,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  forbidden: HttpStatus.FORBIDDEN,
  unauthenticated: HttpStatus.UNAUTHORIZED,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  unavailable: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Problem body of a domain error; also used where no HTTP response is left (SSE). */
export function domainProblem(error: DomainError): ProblemBody {
  return {
    type: problemType(error.code),
    title: error.title,
    status: STATUS_BY_KIND[error.kind],
    detail: error.message,
  };
}

type ProblemBody = Omit<ProblemDetails, 'instance' | 'traceId'>;

/**
 * Global exception filter: turns every error into RFC 9457 Problem Details.
 * Spring analogy: a @ControllerAdvice returning ProblemDetail.
 * Unexpected errors are logged with their stack but never leaked to the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const problem: ProblemDetails = {
      ...this.toProblem(exception),
      instance: request.originalUrl,
      // Set by pino-http (see logger.module.ts): lets support find the request in the logs.
      ...(typeof request.id === 'string' ? { traceId: request.id } : {}),
    };

    response.status(problem.status).type(PROBLEM_JSON).send(JSON.stringify(problem));
  }

  private toProblem(exception: unknown): ProblemBody {
    if (exception instanceof RequestValidationError) {
      return {
        type: problemType('validation-error'),
        title: 'Invalid request',
        status: HttpStatus.BAD_REQUEST,
        detail: `The request has ${exception.errors.length} invalid value(s).`,
        errors: [...exception.errors],
      };
    }

    if (exception instanceof DomainError) return domainProblem(exception);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const title = STATUS_CODES[status] ?? 'Error';
      const detail = exception.message !== title ? exception.message : undefined;
      return { type: 'about:blank', title, status, ...(detail ? { detail } : {}) };
    }

    this.logger.error(exception instanceof Error ? exception : String(exception));
    return {
      type: 'about:blank',
      title: STATUS_CODES[HttpStatus.INTERNAL_SERVER_ERROR] ?? 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'An unexpected error occurred.',
    };
  }
}
