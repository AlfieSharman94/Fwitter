import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Turns the Prisma errors a bad request can trigger into 4xx responses instead of 500s:
// a malformed uuid in a path (P2023), a missing row on update/delete (P2025), and
// invalid query arguments such as an unparsable cursor date.
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: 'invalid_input' });
      return;
    }

    switch (exception.code) {
      case 'P2023': // inconsistent column data, e.g. "abc" where a uuid is expected
        res.status(HttpStatus.BAD_REQUEST).json({ statusCode: 400, message: 'invalid_id' });
        return;
      case 'P2025': // record required by update/delete not found
        res.status(HttpStatus.NOT_FOUND).json({ statusCode: 404, message: 'not_found' });
        return;
      case 'P2002': // unique violation that a handler did not translate itself
        res.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: 'conflict' });
        return;
      default:
        this.logger.error(`prisma ${exception.code}: ${exception.message}`);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}
