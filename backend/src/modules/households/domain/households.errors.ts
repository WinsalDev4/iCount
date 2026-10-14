import { DomainError } from '../../../shared/domain/domain-error.js';

/** Also used for households the caller does not belong to: their existence is not revealed. */
export class HouseholdNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'household-not-found';
  readonly title = 'Household not found';

  constructor(id: string) {
    super(`Household ${id} does not exist or you are not a member.`);
  }
}

export class NotHouseholdAdminError extends DomainError {
  readonly kind = 'forbidden';
  readonly code = 'not-household-admin';
  readonly title = 'Only admins can do this';

  constructor() {
    super('Only the household admins can change this.');
  }
}

export class PersonalHouseholdError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'personal-household';
  readonly title = 'Personal households have one member';

  constructor() {
    super('A personal household cannot have more members. Create a shared one.');
  }
}

export class AlreadyMemberError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'already-member';
  readonly title = 'Already a member';

  constructor() {
    super('You already belong to this household.');
  }
}

export class InvalidInviteError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'invalid-invite';
  readonly title = 'Invalid invite code';

  constructor() {
    super('This invite code does not exist or has already been used.');
  }
}

export class ExpiredInviteError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'expired-invite';
  readonly title = 'Expired invite code';

  constructor() {
    super('This invite code has expired. Ask for a new one.');
  }
}

export class InvalidSplitRuleError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-split-rule';
  readonly title = 'Invalid split rule';
}

export class CurrencyMismatchError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'currency-mismatch';
  readonly title = 'Wrong currency';

  constructor(expected: string, received: string) {
    super(`This household uses ${expected}, not ${received}.`);
  }
}
