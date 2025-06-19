import { ConflictException } from '@nestjs/common';
import { UserRole } from '@db/models/User';

export class UserNotFoundError extends ConflictException {
  constructor(roles: UserRole[]) {
    super(
      `Cannot find user with role ${roles.join(' or ')} to create a ticket`,
    );
  }
}

export class MultipleUsersError extends ConflictException {
  constructor(role: UserRole) {
    super(`Multiple users with role ${role}. Cannot create a ticket`);
  }
}
