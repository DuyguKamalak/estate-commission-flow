import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';

/**
 * Base class for all business-rule / domain-level exceptions.
 *
 * Carries a machine-readable `errorCode` in addition to the HTTP status,
 * so the global exception filter can produce a consistent response shape.
 */
export class DomainException extends HttpException {
  public readonly errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ errorCode, message }, status);
    this.errorCode = errorCode;
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(errorCode: ErrorCode, message: string) {
    super(errorCode, message, HttpStatus.CONFLICT);
  }
}
