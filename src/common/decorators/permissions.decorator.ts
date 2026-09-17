import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/permissions.constant';

export const PERMISSIONS_KEY = 'permissions';

/** Requires the authenticated user's role to carry ALL listed permissions. */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
