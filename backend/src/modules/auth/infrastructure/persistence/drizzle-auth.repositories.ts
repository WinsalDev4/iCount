import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, gte, isNull } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../../shared/database/database.tokens.js';
import { type MagicLink, MagicLinkRepository } from '../../domain/magic-link.js';
import { type RefreshToken, RefreshTokenRepository } from '../../domain/refresh-token.js';
import { User, UserRepository } from '../../domain/user.js';
import { magicLinksTable, refreshTokensTable, usersTable } from './auth.schema.js';

@Injectable()
export class DrizzleUserRepository extends UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    return row ? User.restore(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return row ? User.restore(row) : null;
  }

  async register(user: User): Promise<User> {
    // Two verifications of the same new email at once: the unique index keeps one.
    const [inserted] = await this.db
      .insert(usersTable)
      .values({ id: user.id, email: user.email, displayName: null, createdAt: user.createdAt })
      .onConflictDoNothing({ target: usersTable.email })
      .returning();
    if (inserted) return User.restore(inserted);
    const existing = await this.findByEmail(user.email);
    if (!existing) throw new Error(`User ${user.email} vanished after a conflicting insert`);
    return existing;
  }
}

@Injectable()
export class DrizzleMagicLinkRepository extends MagicLinkRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  async create(link: MagicLink): Promise<void> {
    await this.db.insert(magicLinksTable).values({ ...link, usedAt: null });
  }

  async countCreatedSince(email: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(magicLinksTable)
      .where(and(eq(magicLinksTable.email, email), gte(magicLinksTable.createdAt, since)));
    return row?.total ?? 0;
  }

  async invalidatePending(email: string, now: Date): Promise<void> {
    await this.db
      .update(magicLinksTable)
      .set({ usedAt: now })
      .where(and(eq(magicLinksTable.email, email), isNull(magicLinksTable.usedAt)));
  }

  async consume(tokenHash: string, now: Date): Promise<{ email: string } | null> {
    // One statement: two concurrent verifications cannot both succeed.
    const [row] = await this.db
      .update(magicLinksTable)
      .set({ usedAt: now })
      .where(
        and(
          eq(magicLinksTable.tokenHash, tokenHash),
          isNull(magicLinksTable.usedAt),
          gt(magicLinksTable.expiresAt, now),
        ),
      )
      .returning({ email: magicLinksTable.email });
    return row ?? null;
  }
}

@Injectable()
export class DrizzleRefreshTokenRepository extends RefreshTokenRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  async create(token: RefreshToken): Promise<void> {
    await this.db.insert(refreshTokensTable).values(token);
  }

  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    const [row] = await this.db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async markUsed(id: string, now: Date): Promise<boolean> {
    const updated = await this.db
      .update(refreshTokensTable)
      .set({ usedAt: now })
      .where(and(eq(refreshTokensTable.id, id), isNull(refreshTokensTable.usedAt)))
      .returning({ id: refreshTokensTable.id });
    return updated.length === 1;
  }

  async revokeFamily(familyId: string, now: Date): Promise<void> {
    await this.db
      .update(refreshTokensTable)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokensTable.familyId, familyId), isNull(refreshTokensTable.revokedAt)));
  }
}
