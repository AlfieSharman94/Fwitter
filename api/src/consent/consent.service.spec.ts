import { BadRequestException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { ConsentService } from './consent.service';
import { CONSENT_TOKEN_TTL_MS, hashConsentToken } from './consent-token';

// expo-server-sdk (pulled in through the push service) is ESM-only.
jest.mock('../notifications/push.service', () => ({ PushService: class {} }));

const NOW = new Date('2026-10-23T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 2 * 60_000);
const VALID_TOKEN = 'a'.repeat(43);

type Row = {
  user_id: string;
  guardian_email: string;
  token_hash: string | null;
  token_expires_at: Date | null;
  sent_at: Date | null;
  confirmed_at: Date | null;
};

function row(overrides: Partial<Row> = {}): Row {
  return {
    user_id: 'u1',
    guardian_email: 'parent@example.com',
    token_hash: hashConsentToken(VALID_TOKEN),
    token_expires_at: new Date(NOW.getTime() + CONSENT_TOKEN_TTL_MS),
    sent_at: NOW,
    confirmed_at: null,
    ...overrides,
  };
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    username: 'kid',
    display_name: 'Kid Name',
    date_of_birth: new Date('2012-07-14T00:00:00.000Z'),
    email: 'kid@example.com',
    age_tier: 'JUNIOR',
    cognito_sub: 'sub-1',
    guardian_consent: null as Row | null,
    ...overrides,
  };
}

function makeService(dbUser: ReturnType<typeof user> | null, tokenRow: Row | null = null) {
  const prisma = {
    users: {
      findUnique: jest.fn().mockResolvedValue(dbUser),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockReturnValue('delete-op'),
    },
    guardian_consents: {
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockImplementation(async ({ data }: { data: Partial<Row> }) => ({ ...row({ sent_at: null }), ...data })),
      findUnique: jest.fn().mockResolvedValue(
        tokenRow
          ? {
              ...tokenRow,
              users: {
                id: 'u1',
                username: 'kid',
                display_name: 'Kid Name',
                date_of_birth: new Date('2012-07-14T00:00:00.000Z'),
                email: 'kid@example.com',
                cognito_sub: 'sub-1',
              },
            }
          : null,
      ),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    moderation_actions: { create: jest.fn().mockReturnValue('audit-op') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const email = { send: jest.fn().mockResolvedValue(undefined) };
  const moderation = { invalidateStatus: jest.fn() };
  const env: Record<string, string> = { AWS_REGION: 'eu-north-1', COGNITO_USER_POOL_ID: 'pool-1', PUBLIC_BASE_URL: 'https://api.test/' };
  const config = { get: (key: string) => env[key] };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new ConsentService(prisma as any, email as any, moderation as any, config as any, push as any);
  const cognito = { send: jest.fn().mockResolvedValue({}) };
  (service as any).cognito = cognito;
  return { service, prisma, email, moderation, cognito, push };
}

function sentLink(email: { send: jest.Mock }): string {
  const match = /https:\/\/api\.test\/consent\/([A-Za-z0-9_-]{43})/.exec(email.send.mock.calls[0][0].text);
  if (!match) throw new Error('no link in email');
  return match[1];
}

describe('ConsentService.setGuardian', () => {
  it('refuses STANDARD accounts', async () => {
    const { service } = makeService(user({ age_tier: 'STANDARD' }));
    await expect(service.setGuardian('u1', 'parent@example.com', NOW)).rejects.toThrow(new BadRequestException('consent_not_required'));
  });

  it("refuses the child's own address, whatever the case", async () => {
    const { service, email } = makeService(user());
    await expect(service.setGuardian('u1', ' KID@Example.com ', NOW)).rejects.toThrow(new BadRequestException('guardian_email_same_as_user'));
    expect(email.send).not.toHaveBeenCalled();
  });

  it('refuses once consent is confirmed', async () => {
    const { service } = makeService(user({ guardian_consent: row({ confirmed_at: NOW }) }));
    await expect(service.setGuardian('u1', 'other@example.com', NOW)).rejects.toThrow(new BadRequestException('consent_already_confirmed'));
  });

  it('stores only the hash, emails the link, then records sent_at', async () => {
    const { service, prisma, email } = makeService(user());
    const result = await service.setGuardian('u1', ' Parent@Example.com ', NOW);

    expect(prisma.guardian_consents.upsert).toHaveBeenCalledWith({
      where: { user_id: 'u1' },
      create: { user_id: 'u1', guardian_email: 'parent@example.com' },
      update: { guardian_email: 'parent@example.com' },
    });

    const token = sentLink(email);
    const issued = prisma.guardian_consents.update.mock.calls[0][0];
    expect(issued.data.token_hash).toBe(hashConsentToken(token));
    expect(issued.data.token_expires_at).toEqual(new Date(NOW.getTime() + CONSENT_TOKEN_TTL_MS));
    expect(JSON.stringify(prisma.guardian_consents.update.mock.calls)).not.toContain(token);

    expect(email.send.mock.calls[0][0].to).toBe('parent@example.com');
    expect(email.send.mock.calls[0][0].subject).toContain('@kid');
    expect(email.send.mock.calls[0][0].text).toContain('Kid Name');
    expect(email.send.mock.calls[0][0].text).toContain('14 July 2012');
    expect(prisma.guardian_consents.update.mock.calls[1][0]).toEqual({ where: { user_id: 'u1' }, data: { sent_at: NOW } });
    expect(result).toEqual({ guardian_email: 'parent@example.com', sent_at: NOW, confirmed_at: null });
  });

  it('reports a failed send as 503 and leaves sent_at unset', async () => {
    const { service, prisma, email } = makeService(user());
    email.send.mockRejectedValue(new Error('ses down'));
    await expect(service.setGuardian('u1', 'parent@example.com', NOW)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.guardian_consents.update).toHaveBeenCalledTimes(1);
  });
});

describe('ConsentService.resend', () => {
  it('needs a guardian email on file', async () => {
    const { service } = makeService(user());
    await expect(service.resend('u1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rate limits to one email a minute', async () => {
    const { service, email } = makeService(user({ guardian_consent: row({ sent_at: NOW }) }));
    const err = await service.resend('u1', new Date(NOW.getTime() + 30_000)).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toEqual({ message: 'consent_email_recently_sent' });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('issues a new token after the cooldown', async () => {
    const { service, prisma, email } = makeService(user({ guardian_consent: row({ sent_at: NOW }) }));
    await service.resend('u1', LATER);
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(prisma.guardian_consents.update.mock.calls[0][0].data.token_hash).toBe(hashConsentToken(sentLink(email)));
  });

  it('refuses once consent is confirmed', async () => {
    const { service } = makeService(user({ guardian_consent: row({ confirmed_at: NOW }) }));
    await expect(service.resend('u1', LATER)).rejects.toThrow(new BadRequestException('consent_already_confirmed'));
  });
});

describe('ConsentService.ensureRequested', () => {
  it('does nothing for STANDARD accounts', async () => {
    const { service, email } = makeService(user({ age_tier: 'STANDARD' }));
    await expect(service.ensureRequested('u1', 'parent@example.com', NOW)).resolves.toBeNull();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('returns null for a JUNIOR who gave no email yet', async () => {
    const { service, email } = makeService(user());
    await expect(service.ensureRequested('u1', undefined, NOW)).resolves.toBeNull();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends the first email when a JUNIOR gives an address', async () => {
    const { service, prisma, email } = makeService(user());
    await service.ensureRequested('u1', 'parent@example.com', NOW);
    expect(prisma.guardian_consents.upsert).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('does not resend when a resumed sign-up repeats the same address', async () => {
    const existing = row({ sent_at: NOW });
    const { service, email } = makeService(user({ guardian_consent: existing }));
    await expect(service.ensureRequested('u1', 'Parent@example.com', LATER)).resolves.toEqual({
      guardian_email: 'parent@example.com',
      sent_at: NOW,
      confirmed_at: null,
    });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('switches to a different address and emails it', async () => {
    const { service, prisma, email } = makeService(user({ guardian_consent: row({ sent_at: NOW }) }));
    await service.ensureRequested('u1', 'other@example.com', LATER);
    expect(prisma.guardian_consents.upsert.mock.calls[0][0].update).toEqual({ guardian_email: 'other@example.com' });
    expect(email.send.mock.calls[0][0].to).toBe('other@example.com');
  });

  it('retries a send that failed earlier', async () => {
    const { service, prisma, email } = makeService(user({ guardian_consent: row({ sent_at: null }) }));
    await service.ensureRequested('u1', undefined, LATER);
    expect(prisma.guardian_consents.upsert).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('leaves a confirmed record alone', async () => {
    const { service, email } = makeService(user({ guardian_consent: row({ confirmed_at: NOW, token_hash: null }) }));
    const result = await service.ensureRequested('u1', 'other@example.com', LATER);
    expect(result?.confirmed_at).toEqual(NOW);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('ConsentService.confirm', () => {
  it('records the consent, burns the token and unblocks the account', async () => {
    const current = row();
    const { service, prisma, moderation } = makeService(user(), current);
    await expect(service.confirm(VALID_TOKEN, LATER)).resolves.toBe('confirmed');
    expect(prisma.guardian_consents.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { token_hash: current.token_hash } }));
    expect(prisma.guardian_consents.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', token_hash: current.token_hash },
      data: { confirmed_at: LATER, token_hash: null, token_expires_at: null },
    });
    expect(moderation.invalidateStatus).toHaveBeenCalledWith('u1');
  });

  it('refuses an expired link without touching the row', async () => {
    const { service, prisma } = makeService(user(), row({ token_expires_at: new Date(NOW.getTime() - 1) }));
    await expect(service.confirm(VALID_TOKEN, NOW)).resolves.toBe('expired');
    expect(prisma.guardian_consents.updateMany).not.toHaveBeenCalled();
  });

  it('treats unknown and malformed tokens as invalid', async () => {
    const { service, prisma } = makeService(user(), null);
    await expect(service.confirm(VALID_TOKEN, NOW)).resolves.toBe('invalid');
    await expect(service.confirm('not-a-token', NOW)).resolves.toBe('invalid');
    expect(prisma.guardian_consents.findUnique).toHaveBeenCalledTimes(1);
  });

  it('lets only one of two concurrent clicks win', async () => {
    const { service, prisma, moderation } = makeService(user(), row());
    prisma.guardian_consents.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.confirm(VALID_TOKEN, NOW)).resolves.toBe('invalid');
    expect(moderation.invalidateStatus).not.toHaveBeenCalled();
  });
});

describe('ConsentService.decline', () => {
  it('deletes the Cognito login, then the account with an audit row', async () => {
    const { service, prisma, cognito, moderation } = makeService(user(), row());
    await expect(service.decline(VALID_TOKEN, NOW)).resolves.toBe('deleted');

    expect(cognito.send).toHaveBeenCalledTimes(1);
    const command = cognito.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(AdminDeleteUserCommand);
    expect(command.input).toEqual({ UserPoolId: 'pool-1', Username: 'kid@example.com' });

    expect(prisma.moderation_actions.create).toHaveBeenCalledWith({
      data: { action: 'GUARDIAN_DELETE_USER', note: 'guardian parent@example.com declined consent for @kid' },
    });
    expect(prisma.users.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['audit-op', 'delete-op']);
    expect(moderation.invalidateStatus).toHaveBeenCalledWith('u1');
  });

  it('falls back to the sub when Cognito does not know the email', async () => {
    const { service, cognito } = makeService(user(), row());
    cognito.send.mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'UserNotFoundException' }));
    await expect(service.decline(VALID_TOKEN, NOW)).resolves.toBe('deleted');
    expect(cognito.send.mock.calls.map((c) => c[0].input.Username)).toEqual(['kid@example.com', 'sub-1']);
  });

  it('leaves the database untouched when Cognito refuses', async () => {
    const { service, prisma, cognito } = makeService(user(), row());
    cognito.send.mockRejectedValue(Object.assign(new Error('denied'), { name: 'AccessDeniedException' }));
    await expect(service.decline(VALID_TOKEN, NOW)).resolves.toBe('error');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.users.delete).not.toHaveBeenCalled();
  });

  it('refuses expired and unknown links', async () => {
    const expired = makeService(user(), row({ token_expires_at: new Date(NOW.getTime() - 1) }));
    await expect(expired.service.decline(VALID_TOKEN, NOW)).resolves.toBe('expired');
    const unknown = makeService(user(), null);
    await expect(unknown.service.decline(VALID_TOKEN, NOW)).resolves.toBe('invalid');
    expect(expired.cognito.send).not.toHaveBeenCalled();
    expect(unknown.cognito.send).not.toHaveBeenCalled();
  });
});

describe('ConsentService.lookup', () => {
  it('describes the link for the page', async () => {
    const valid = makeService(user(), row());
    await expect(valid.service.lookup(VALID_TOKEN, NOW)).resolves.toEqual({
      state: 'valid',
      username: 'kid',
      displayName: 'Kid Name',
      dateOfBirth: new Date('2012-07-14T00:00:00.000Z'),
    });
    const expired = makeService(user(), row({ token_expires_at: new Date(NOW.getTime() - 1) }));
    await expect(expired.service.lookup(VALID_TOKEN, NOW)).resolves.toEqual({ state: 'expired' });
    const unknown = makeService(user(), null);
    await expect(unknown.service.lookup(VALID_TOKEN, NOW)).resolves.toEqual({ state: 'invalid' });
  });
});

describe('ConsentService from the parent or guardian account', () => {
  const adult = { id: 'a1', email: 'Parent@Example.com', date_of_birth: new Date('1985-01-01T00:00:00.000Z') };
  const teen = { id: 'a2', email: 'parent@example.com', date_of_birth: new Date('2009-01-01T00:00:00.000Z') };

  function forAdult(approver: typeof adult, consent: Row | null = row()) {
    const made = makeService(null);
    const kid = { id: 'u1', username: 'kid', email: 'kid@example.com', cognito_sub: 'sub-1' };
    made.prisma.users.findUnique.mockImplementation(async ({ where }: any) => (where.id === approver.id ? approver : where.id === 'u1' ? kid : null));
    made.prisma.guardian_consents.findUnique.mockResolvedValue(consent);
    return made;
  }

  it('lists pending children who gave the adult\'s email, with their date of birth', async () => {
    const { service, prisma } = forAdult(adult);
    prisma.guardian_consents.findMany.mockResolvedValue([
      {
        sent_at: NOW,
        users: { id: 'u1', username: 'kid', display_name: 'Kid Name', profile_image_url: null, date_of_birth: new Date('2012-07-14T00:00:00.000Z') },
      },
    ]);
    await expect(service.pendingFor('a1')).resolves.toEqual([
      { userId: 'u1', username: 'kid', displayName: 'Kid Name', avatarUrl: null, dateOfBirth: '2012-07-14', requestedAt: NOW },
    ]);
    expect(prisma.guardian_consents.findMany.mock.calls[0][0].where).toEqual({
      guardian_email: 'parent@example.com',
      confirmed_at: null,
      sent_at: { not: null },
    });
  });

  it('shows nothing to an account under 18', async () => {
    const { service, prisma } = forAdult(teen);
    await expect(service.pendingFor('a2')).resolves.toEqual([]);
    expect(prisma.guardian_consents.findMany).not.toHaveBeenCalled();
  });

  it('confirms only a pending child who gave this email, even after the link expired', async () => {
    const { service, prisma, moderation } = forAdult(adult, row({ token_expires_at: new Date(NOW.getTime() - 1) }));
    await service.confirmFor('a1', 'u1', NOW);
    expect(prisma.guardian_consents.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', guardian_email: 'parent@example.com', confirmed_at: null },
      data: { confirmed_at: NOW, token_hash: null, token_expires_at: null },
    });
    expect(moderation.invalidateStatus).toHaveBeenCalledWith('u1');

    const other = forAdult(adult, row({ guardian_email: 'someone@example.com' }));
    await expect(other.service.confirmFor('a1', 'u1', NOW)).rejects.toBeInstanceOf(NotFoundException);
    const done = forAdult(adult, row({ confirmed_at: NOW }));
    await expect(done.service.confirmFor('a1', 'u1', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('declining deletes the child account and its login', async () => {
    const { service, prisma, cognito } = forAdult(adult);
    await service.declineFor('a1', 'u1');
    expect(cognito.send).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(['audit-op', 'delete-op']);
  });

  it('pushes the adult account when a link is sent to its email', async () => {
    const { service, prisma, push } = makeService(user());
    prisma.users.findFirst.mockResolvedValue({ id: 'a1', date_of_birth: adult.date_of_birth });
    await service.setGuardian('u1', 'parent@example.com', NOW);
    await new Promise((r) => setImmediate(r));
    expect(push.sendToUser).toHaveBeenCalledWith('a1', expect.objectContaining({ data: { url: '/(tabs)/activity', type: 'CONSENT_REQUEST' } }));
  });
});
