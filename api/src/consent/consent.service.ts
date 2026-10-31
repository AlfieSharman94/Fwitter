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
import { PushService } from '../notifications/push.service';
import { LinksService } from '../links/links.service';
import { calculateAge } from '../users/age-tier.util';
import { createConsentToken, hashConsentToken, isConsentTokenShape } from './consent-token';
import { consentEmail, type ConsentChild } from './consent-pages';

const RESEND_COOLDOWN_MS = 60_000;

export type ConsentPublic = { guardian_email: string; sent_at: Date | null; confirmed_at: Date | null };
export type ConsentLookup = ({ state: 'valid' } & ConsentChild) | { state: 'expired' } | { state: 'invalid' };
export type ConsentRequest = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  dateOfBirth: string;
  requestedAt: Date | null;
};

// Approving in the app is for the parent or guardian's own adult account.
const APPROVER_MIN_AGE = 18;
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
  display_name: string;
  date_of_birth: Date;
  email: string;
  age_tier: AgeTier;
  cognito_sub: string | null;
  guardian_consent: ConsentRow | null;
};

const userSelect = {
  id: true,
  username: true,
  display_name: true,
  date_of_birth: true,
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
    private readonly push: PushService,
    private readonly links: LinksService,
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
    return { state: 'valid', ...childOf(row.users) };
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

  async decline(token: string, now: Date = new Date()): Promise<ConsentOutcome> {
    const row = await this.findByToken(token);
    if (!row) return 'invalid';
    if (this.expired(row, now)) return 'expired';
    return this.deleteChild(row.users, row.guardian_email);
  }

  // ---- From the parent or guardian's own account (authenticated) -----------

  // Pending children who gave this adult's email. The emailed link's 7-day expiry doesn't
  // apply here: the signed-in account is the proof, not the token.
  async pendingFor(adultId: string): Promise<ConsentRequest[]> {
    const email = await this.approverEmail(adultId);
    if (!email) return [];
    const rows = await this.prisma.guardian_consents.findMany({
      where: { guardian_email: email, confirmed_at: null, sent_at: { not: null } },
      orderBy: { sent_at: 'desc' },
      select: {
        sent_at: true,
        users: { select: { id: true, username: true, display_name: true, profile_image_url: true, date_of_birth: true } },
      },
    });
    return rows.map((r) => ({
      userId: r.users.id,
      username: r.users.username,
      displayName: r.users.display_name,
      avatarUrl: r.users.profile_image_url,
      dateOfBirth: r.users.date_of_birth.toISOString().slice(0, 10),
      requestedAt: r.sent_at,
    }));
  }

  // link: the "Link @child to my account" tick box on the approval card.
  async confirmFor(adultId: string, childId: string, link: boolean, now: Date = new Date()): Promise<void> {
    const email = await this.requirePendingFor(adultId, childId);
    const { count } = await this.prisma.guardian_consents.updateMany({
      where: { user_id: childId, guardian_email: email, confirmed_at: null },
      data: { confirmed_at: now, token_hash: null, token_expires_at: null },
    });
    if (count === 0) throw new NotFoundException('consent_request_not_found');
    this.moderation.invalidateStatus(childId);
    if (link) await this.links.linkFromConsent(adultId, childId, now);
  }

  async declineFor(adultId: string, childId: string): Promise<void> {
    const email = await this.requirePendingFor(adultId, childId);
    const child = await this.prisma.users.findUnique({
      where: { id: childId },
      select: { id: true, username: true, email: true, cognito_sub: true },
    });
    if (!child) throw new NotFoundException('consent_request_not_found');
    if ((await this.deleteChild(child, email)) === 'error') throw new ServiceUnavailableException('consent_decline_failed');
  }

  // ---- Internals -----------------------------------------------------------

  // The parent or guardian does not consent: the account goes, as it would with DELETE
  // /users/me, plus the Cognito login (the child has no session to do it from). Cognito first,
  // so a failure leaves nothing half-deleted; the account simply stays locked.
  private async deleteChild(
    user: { id: string; username: string; email: string; cognito_sub: string | null },
    guardianEmail: string,
  ): Promise<ConsentOutcome> {
    try {
      await this.deleteCognitoUser(user);
    } catch (e) {
      this.logger.error(`guardian decline: Cognito delete failed for @${user.username}: ${(e as Error)?.message ?? e}`);
      return 'error';
    }
    await this.prisma.$transaction([
      // Evidence that survives the cascade: the target would be nulled with the user anyway.
      this.prisma.moderation_actions.create({
        data: { action: ModerationAction.GUARDIAN_DELETE_USER, note: `guardian ${guardianEmail} declined consent for @${user.username}` },
      }),
      this.prisma.users.delete({ where: { id: user.id } }),
    ]);
    this.moderation.invalidateStatus(user.id);
    return 'deleted';
  }

  // The adult's email, or null when the account is too young to approve.
  private async approverEmail(adultId: string): Promise<string | null> {
    const adult = await this.prisma.users.findUnique({ where: { id: adultId }, select: { email: true, date_of_birth: true } });
    if (!adult || calculateAge(adult.date_of_birth) < APPROVER_MIN_AGE) return null;
    return adult.email.trim().toLowerCase();
  }

  private async requirePendingFor(adultId: string, childId: string): Promise<string> {
    const email = await this.approverEmail(adultId);
    const row = email ? await this.prisma.guardian_consents.findUnique({ where: { user_id: childId } }) : null;
    if (!email || !row || row.guardian_email !== email || row.confirmed_at) throw new NotFoundException('consent_request_not_found');
    return email;
  }

  // Best effort: the email is what counts, the push only helps when the parent or guardian
  // already has an account here.
  private async notifyApprover(child: ConsentUser, guardianEmail: string) {
    try {
      const adult = await this.prisma.users.findFirst({
        where: { email: { equals: guardianEmail, mode: 'insensitive' } },
        select: { id: true, date_of_birth: true },
      });
      if (!adult || calculateAge(adult.date_of_birth) < APPROVER_MIN_AGE) return;
      await this.push.sendToUser(adult.id, {
        title: `@${child.username} wants to join Fwitter`,
        body: 'They gave your email as their parent or guardian. Tap to check their details and approve.',
        data: { url: '/(tabs)/activity', type: 'CONSENT_REQUEST' },
      });
    } catch (e) {
      this.logger.warn(`consent push for @${child.username} failed: ${(e as Error)?.message ?? e}`);
    }
  }

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
      await this.email.send({ to: guardianEmail, ...consentEmail({ ...childOf(user), link }) });
    } catch (e) {
      this.logger.error(`consent email to ${guardianEmail} failed: ${(e as Error)?.message ?? e}`);
      throw new ServiceUnavailableException('consent_email_failed');
    }
    const row = await this.prisma.guardian_consents.update({ where: { user_id: user.id }, data: { sent_at: now } });
    void this.notifyApprover(user, guardianEmail);
    return this.toPublic(row) as ConsentPublic;
  }

  private findByToken(token: string) {
    if (!isConsentTokenShape(token)) return null;
    return this.prisma.guardian_consents.findUnique({
      where: { token_hash: hashConsentToken(token) },
      include: {
        users: { select: { id: true, username: true, display_name: true, date_of_birth: true, email: true, cognito_sub: true } },
      },
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

function childOf(u: { username: string; display_name: string; date_of_birth: Date }): ConsentChild {
  return { username: u.username, displayName: u.display_name, dateOfBirth: u.date_of_birth };
}
