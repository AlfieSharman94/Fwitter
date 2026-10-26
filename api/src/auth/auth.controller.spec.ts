import { AuthController } from './auth.controller';

function build(opts: { inDb?: boolean; inCognito?: boolean; cognitoFails?: boolean }) {
  const prisma = { users: { findFirst: jest.fn().mockResolvedValue(opts.inDb ? { id: 'u1' } : null) } } as any;
  const config = { get: (k: string) => (k === 'COGNITO_USER_POOL_ID' ? 'eu-north-1_test' : 'eu-north-1') } as any;
  const controller = new AuthController(prisma, config);
  const send = jest.fn();
  if (opts.cognitoFails) send.mockRejectedValue(new Error('AccessDeniedException'));
  else send.mockResolvedValue({ Users: opts.inCognito ? [{ Username: 'abc' }] : [] });
  (controller as any).cognito = { send };
  return { controller, send };
}

describe('AuthController email-available', () => {
  it('is taken when the profile table has the address, without asking Cognito', async () => {
    const { controller, send } = build({ inDb: true });

    expect(await controller.emailAvailable('Someone@Example.com')).toEqual({ available: false });
    expect(send).not.toHaveBeenCalled();
  });

  it('is taken when only Cognito has a login for the address', async () => {
    const { controller, send } = build({ inCognito: true });

    expect(await controller.emailAvailable('someone@example.com')).toEqual({
      available: false,
      reason: 'existing_login',
    });
    expect(send.mock.calls[0][0].input).toMatchObject({
      UserPoolId: 'eu-north-1_test',
      Filter: 'email = "someone@example.com"',
      Limit: 1,
    });
  });

  it('is available when neither the database nor Cognito knows it', async () => {
    const { controller } = build({});

    expect(await controller.emailAvailable('new@example.com')).toEqual({ available: true });
  });

  it('falls back to the database answer when Cognito cannot be queried', async () => {
    const { controller } = build({ cognitoFails: true });

    expect(await controller.emailAvailable('new@example.com')).toEqual({ available: true });
  });

  it('refuses an address that could break the Cognito filter', async () => {
    const { controller, send } = build({});

    expect(await controller.emailAvailable('a"b@example.com')).toEqual({ available: false, reason: 'invalid_format' });
    expect(send).not.toHaveBeenCalled();
  });
});
