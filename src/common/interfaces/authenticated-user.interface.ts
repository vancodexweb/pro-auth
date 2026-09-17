import { Permission } from '../constants/permissions.constant';

/** Shape of the JWT access token payload, attached to `request.user` by JwtStrategy. */
export interface AuthenticatedUser {
  sub: string; // user id
  email: string;
  role: string;
  permissions: Permission[];
}
