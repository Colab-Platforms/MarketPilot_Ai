import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ErrorCode, type ErrorEnvelope } from '@marketpilot/contracts';
import { DomainError } from './domain-error';

const statusToCode: Record<number, ErrorCode> = {
  400: ErrorCode.Validation,
  401: ErrorCode.Unauthenticated,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  429: ErrorCode.RateLimited,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toEnvelope(exception);
    if (status >= 500) this.logger.error(exception);
    response.status(status).json(body);
  }

  private toEnvelope(exception: unknown): { status: number; body: ErrorEnvelope } {
    if (exception instanceof DomainError) {
      return {
        status: exception.status,
        body: {
          error: { code: exception.code, message: exception.message, details: exception.details },
        },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        body: {
          error: { code: statusToCode[status] ?? ErrorCode.Internal, message: exception.message },
        },
      };
    }
    return {
      status: 500,
      body: { error: { code: ErrorCode.Internal, message: 'Something went wrong' } },
    };
  }
}
