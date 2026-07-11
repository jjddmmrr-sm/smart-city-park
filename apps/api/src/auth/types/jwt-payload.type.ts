import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
