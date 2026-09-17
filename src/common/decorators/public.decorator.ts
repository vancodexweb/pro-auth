import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks an endpoint as reachable without a JWT (registration, login, health, ...). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
