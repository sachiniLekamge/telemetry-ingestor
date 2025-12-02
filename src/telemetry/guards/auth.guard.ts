import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly expectedToken: string;

  constructor(private configService: ConfigService) {
    this.expectedToken = this.configService.get<string>('INGEST_TOKEN');
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.expectedToken) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.replace('Bearer ', '');

    if (token !== this.expectedToken) {
      this.logger.warn('Invalid token attempt');
      throw new UnauthorizedException('Invalid authorization token');
    }

    return true;
  }
}
