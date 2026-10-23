import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminDeleteUserCommand, CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { AgeTier, ModerationAction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { ModerationService } from '../moderation/moderation.service';
import { createConsentToken, hashConsentToken, isConsentTokenShape } from './consent-token';
import { consentEmail } from './consent-pages';

const RESEND_COOLDOWN_MS = 60_000;

export type ConsentPublic = { guardian_email: string; sent_at: Date | null; confirmed_at: Date | null };
export type ConsentLookup = { state: 'valid'; username: string } | { state: 'expired' } | { state: 'invalid' };
export type ConsentOutcome = 'confirmed' | 'deleted' | 'expired' | 'invalid' | 'error';

type ConsentRow = {
  guardian_email: string;
  token_hash: string | null;
  token_expires_at: Date | null;
  sent_at: Date | null;
  confirmed_at: Date | null;
};

type ConsentUser = {
  id: string;
  username: string;
  email: string;
  age_tier: AgeTier;
  cognito_sub: string | null;
  guardian_consent: ConsentRow | null;
};

const userSelect = {
  id: true,
  username: true,
  email: true,
  age_tier: true,
  cognito_sub: true,
  guardian_consent: true,
} as const;

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);
  private readonly cognito: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly moderation: ModerationService,
    config: ConfigService,
  ) {
    this.cognito = new CognitoIdentityProviderClient({ region: config.get<string>('AWS_REGION') ?? 'eu-north-1' });
    this.userPoolId = config.get<string>('COGNITO_USER_POOL_ID') ?? '';
    const railway = config.get<string>('RAILWAY_PUBLIC_DOMAIN');
    const fallback = railway ? `https://${railway}` : `http://localhost:${config.get<string>('PORT') ?? 3000}`;
    this.baseUrl = (config.get<string>('PUBLIC_BASE_URL') || fallback).replace(/\/+$/, '');
  }

  toPublic(row: ConsentRow | null): ConsentPublic | null {
    return row ? { guardian_email: row.guardian_email, sent_at: row.sent_at, confirmed_at: row.confirmed_at } : null;
  }

  // ---- From the app (authenticated) ----------------------------------------

  // First guardian email, or a change of it. Always sends a fresh link.
  async setGuardian(userId: string, guardianEmail: string, now: Date = new Date()): Promise<ConsentPublic> {
    const user = await this.requireUser(userId);
    const email = guardianEmail.trim().toLowerCase();
    if (user.age_tier !== AgeTier.JUNIOR) throw new BadRequestException('consent_not_required');
    if (user.guardian_consent?.confirmed_at) throw new BadRequestException('consent_already_confirmed');
    if (email === user.email.trim().toLowerCase()) throw new BadRequestException('guardian_email_same_as_user');

    await this.prisma.guardian_consents.upsert({
      where: { user_id: user.id },
      create: { user_id: user.id, guardian_email: email },
      update: { guardian_email: email },
    });
    return this.issueAndSend(user, email, now);
  }

  async resend(userId: string, now: Date = new Date()): Promise<ConsentPublic> {
    const user = await this.requireUser(userId);
    const row = user.guardian_consent;
    if (user.age_tier !== AgeTier.JUNIOR) throw new BadRequestException('consent_not_required');
    if (!row) throw new NotFoundException('consent_not_requested');
    if (row.confirmed_at) throw new BadRequestException('consent_already_confirmed');
    if (row.sent_at && now.getTime() - row.sent_at.getTime() < RESEND_COOLDOWN_MS) {
      throw new HttpException({ message: 'consent_email_recently_sent' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.issueAndSend(user, row.guardian_email, now);
  }

  // Onboarding complete. Idempotent: a resumed sign-up re-runs it with the same email and must
  // not send the guardian a second copy. Returns null when nothing is needed yet (STANDARD, or a
  // JUNIOR who gave no email; the pending screen collects it).
  async ensureRequested(userId: string, guardianEmail: string | undefined, now: Date = new Date()): Promise<ConsentPublic | null> {
    const user = await this.requireUser(userId);
    if (user.age_tier !== AgeTier.JUNIOR) return null;
    const row = user.guardian_consent;
    const email = guardianEmail?.trim().toLowerCase();
    if (!row) return email ? this.setGuardian(user.id, email, now) : null;
    if (row.confirmed_at) return this.toPublic(row);
    if (email && email !== row.guardian_email) return this.setGuardian(user.id, email, now);
    if (!row.sent_at) return this.issueAndSend(user, row.guardian_email, now);
    return this.toPublic(row);
  }

  // ---- From the emailed link (public) --------------------------------------

  async lookup(token: string, now: Date = new Date()): Promise<ConsentLookup> {
    const row = await this.findByToken(token);
    if (!row) return { state: 'invalid' };
    if (this.expired(row, now)) return { state: 'expired' };
    return { state: 'valid', username: row.users.username };
  }

  async confirm(token: string, now: Date = new Date()): Promise<ConsentOutcome> {
    const row = await this.findByToken(token);
    if (!row) return 'invalid';
    if (this.expired(row, now)) return 'expired';
    // Keyed on the hash too, so two clicks on the same link cannot both succeed.
    const { count } = await this.prisma.guardian_consents.updateMany({
      where: { user_id: row.user_id, token_hash: row.token_hash },
      data: { confirmed_at: now, token_hash: null, token_expires_at: null },
    });
    if (count === 0) return 'invalid';
    this.moderation.invalidateStatus(row.user_id);
    return 'confirmed';
  }

  // The guardian does not consent: the account goes, as it would with DELETE /users/me, plus
  // the Cognito login (the child has no session to do it from). Cognito first, so a failure
  // leaves nothing half-deleted; the account simply stays locked and the link stays valid.
  async decline(token: string, now: Date = new Date()): Promise<ConsentOutcome> {
    const row = await this.findByToken(token);
    if (!row) return 'invalid';
    if (this.expired(row, now)) return 'expired';
    const user = row.users;
    try {
      await this.deleteCognitoUser(user);
    } catch (e) {
      this.logger.error(`guardian decline: Cognito delete failed for @${user.username}: ${(e as Error)?.message ?? e}`);
      return 'error';
    }
    await this.prisma.$transaction([
      // Evidence that survives the cascade: the target would be nulled with the user anyway.
      this.prisma.moderation_actions.create({
        data: { action: ModerationAction.GUARDIAN_DELETE_USER, note: `guardian ${row.guardian_email} declined consent for @${user.username}` },
      }),
      this.prisma.users.delete({ where: { id: user.id } }),
    ]);
    this.moderation.invalidateStatus(user.id);
    return 'deleted';
  }

  // ---- Internals -----------------------------------------------------------

  private async requireUser(userId: string): Promise<ConsentUser> {
    const user = await this.prisma.users.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw new NotFoundException('user_not_found');
    return user;
  }

  private async issueAndSend(user: ConsentUser, guardianEmail: string, now: Date): Promise<ConsentPublic> {
    const { token, hash, expiresAt } = createConsentToken(now);
    await this.prisma.guardian_consents.update({
      where: { user_id: user.id },
      data: { token_hash: hash, token_expires_at: expiresAt },
    });
    const link = `${this.baseUrl}/consent/${token}`;
    try {
      await this.email.send({ to: guardianEmail, ...consentEmail({ username: user.username, link }) });
    } catch (e) {
      this.logger.error(`consent email to ${guardianEmail} failed: ${(e as Error)?.message ?? e}`);
      throw new ServiceUnavailableException('consent_email_failed');
    }
    const row = await this.prisma.guardian_consents.update({ where: { user_id: user.id }, data: { sent_at: now } });
    return this.toPublic(row) as ConsentPublic;
  }

  private findByToken(token: string) {
    if (!isConsentTokenShape(token)) return null;
    return this.prisma.guardian_consents.findUnique({
      where: { token_hash: hashConsentToken(token) },
      include: { users: { select: { id: true, username: true, email: true, cognito_sub: true } } },
    });
  }

  private expired(row: { token_expires_at: Date | null }, now: Date) {
    return !row.token_expires_at || row.token_expires_at.getTime() < now.getTime();
  }

  // Which identifier Cognito accepts depends on the pool's username settings (the app signs up
  // with the email as the username), so the email is tried first and the sub second.
  private async deleteCognitoUser(user: { username: string; email: string; cognito_sub: string | null }) {
    if (!this.userPoolId) throw new Error('COGNITO_USER_POOL_ID not set');
    const names = [user.email, user.cognito_sub].filter((v): v is string => !!v);
    for (const name of names) {
      try {
        await this.cognito.send(new AdminDeleteUserCommand({ UserPoolId: this.userPoolId, Username: name }));
        return;
      } catch (e: any) {
        if (e?.name !== 'UserNotFoundException') throw e;
      }
    }
    this.logger.warn(`guardian decline: no Cognito user found for @${user.username}; treating as already deleted`);
  }
}
