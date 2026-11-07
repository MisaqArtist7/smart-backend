import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | 'CUSTOMER' | 'ADMIN')[]) =>
  SetMetadata(ROLES_KEY, roles);
