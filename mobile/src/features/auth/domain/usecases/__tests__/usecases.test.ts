import { InMemoryAuthRepository } from '../../../data/InMemoryAuthRepository';
import { AuthError } from '../../AuthError';
import type { AuthRepository } from '../../AuthRepository';
import { GetSession } from '../GetSession';
import { RequestMagicLink } from '../RequestMagicLink';
import { SignOut } from '../SignOut';
import { VerifyMagicLink } from '../VerifyMagicLink';

/** A repository that records calls, to prove what the use cases do (and do not) forward. */
function spyRepository(): AuthRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    requestMagicLink: async (email) => void calls.push(`request:${email}`),
    verifyMagicLink: async (token) => {
      calls.push(`verify:${token}`);
      return { user: { id: 'u1' as never, email: 'ana@casa.app', displayName: null } };
    },
    getSession: async () => null,
    signOut: async () => void calls.push('signOut'),
  };
}

describe('RequestMagicLink', () => {
  it('sends the normalized email and returns it', async () => {
    const repository = spyRepository();
    const sentTo = await new RequestMagicLink(repository).execute('  Ana@Casa.APP ');
    expect(sentTo).toBe('ana@casa.app');
    expect(repository.calls).toEqual(['request:ana@casa.app']);
  });

  it('rejects an invalid email without calling the repository', async () => {
    const repository = spyRepository();
    await expect(new RequestMagicLink(repository).execute('no-es-correo')).rejects.toMatchObject({
      reason: 'invalid-email',
    });
    expect(repository.calls).toEqual([]);
  });

  it('lets repository failures through unchanged', async () => {
    const repository = spyRepository();
    repository.requestMagicLink = () => Promise.reject(new AuthError('too-many-requests'));
    await expect(new RequestMagicLink(repository).execute('ana@casa.app')).rejects.toMatchObject({
      reason: 'too-many-requests',
    });
  });
});

describe('VerifyMagicLink', () => {
  it('forwards the trimmed token and returns the session', async () => {
    const repository = spyRepository();
    const session = await new VerifyMagicLink(repository).execute('  tok-123 ');
    expect(session.user.email).toBe('ana@casa.app');
    expect(repository.calls).toEqual(['verify:tok-123']);
  });

  it.each([undefined, null, '', '   '])('rejects a missing token (%j) locally', async (token) => {
    const repository = spyRepository();
    await expect(new VerifyMagicLink(repository).execute(token)).rejects.toMatchObject({
      reason: 'invalid-or-expired-link',
    });
    expect(repository.calls).toEqual([]);
  });
});

describe('SignOut and GetSession with the in-memory repository', () => {
  it('has no session until a link is verified', async () => {
    const repository = new InMemoryAuthRepository();
    expect(await new GetSession(repository).execute()).toBeNull();
  });

  it('keeps the session after verifying and forgets it on sign-out', async () => {
    const repository = new InMemoryAuthRepository();
    await new RequestMagicLink(repository).execute('Leo@Casa.app');
    await new VerifyMagicLink(repository).execute('any-token');
    expect((await new GetSession(repository).execute())?.user.email).toBe('leo@casa.app');

    await new SignOut(repository).execute();
    expect(await new GetSession(repository).execute()).toBeNull();
  });
});

describe('InMemoryAuthRepository', () => {
  it('accepts any non-empty token (memory mode)', async () => {
    const session = await new InMemoryAuthRepository().verifyMagicLink('literally-anything');
    expect(session.user.email).toContain('@');
  });

  it('rejects an empty token and an invalid email like the API would', async () => {
    const repository = new InMemoryAuthRepository();
    await expect(repository.verifyMagicLink('  ')).rejects.toMatchObject({
      reason: 'invalid-or-expired-link',
    });
    await expect(repository.requestMagicLink('nope')).rejects.toMatchObject({
      reason: 'invalid-email',
    });
  });
});
