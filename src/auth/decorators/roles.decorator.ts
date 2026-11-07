import { SetMetadata } from '@nestjs/common';
import { Role } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (Role | keyof typeof Role | string)[]) =>
  SetMetadata(ROLES_KEY, roles);
