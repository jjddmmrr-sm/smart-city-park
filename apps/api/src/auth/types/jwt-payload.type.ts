import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  cityId: string | null;
  roles: string[];
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
