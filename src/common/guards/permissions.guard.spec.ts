import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../constants/permissions.constant';

function buildContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  function buildGuard(required: Permission[] | undefined) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(required),
    } as unknown as Reflector;
    return new PermissionsGuard(reflector);
  }

  it('allows the request through when the route requires no permissions', () => {
    const guard = buildGuard(undefined);
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('rejects an unauthenticated request when permissions are required', () => {
    const guard = buildGuard([Permission.DOCUMENTS_APPROVE]);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('rejects a user missing the required permission', () => {
    const guard = buildGuard([Permission.DOCUMENTS_APPROVE]);
    const user = {
      sub: 'u1',
      email: 'a@b.com',
      role: 'WORKER',
      permissions: [Permission.DOCUMENTS_MANAGE],
    };
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('requires every listed permission, not just one of them', () => {
    const guard = buildGuard([Permission.DOCUMENTS_MANAGE, Permission.DOCUMENTS_APPROVE]);
    const user = {
      sub: 'u1',
      email: 'a@b.com',
      role: 'WORKER',
      permissions: [Permission.DOCUMENTS_MANAGE],
    };
    expect(() => guard.canActivate(buildContext(user))).toThrow(ForbiddenException);
  });

  it('allows a user holding every required permission', () => {
    const guard = buildGuard([Permission.DOCUMENTS_APPROVE]);
    const user = {
      sub: 'u1',
      email: 'a@b.com',
      role: 'ADMIN',
      permissions: [Permission.DOCUMENTS_APPROVE],
    };
    expect(guard.canActivate(buildContext(user))).toBe(true);
  });
});
