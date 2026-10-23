import { SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailService } from './email.service';

function makeService(from: string) {
  const config = { get: (key: string) => (key === 'EMAIL_FROM' ? from : 'eu-north-1') } as any;
  const service = new EmailService(config);
  const send = jest.fn().mockResolvedValue({});
  (service as any).ses = { send };
  return { service, send };
}

const message = { to: 'parent@example.com', subject: 'Hello', text: 'plain', html: '<p>html</p>' };

describe('EmailService', () => {
  it('logs instead of sending when EMAIL_FROM is empty', async () => {
    const { service, send } = makeService('');
    expect(service.enabled).toBe(false);
    await service.send(message);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends through SES from the configured identity', async () => {
    const { service, send } = makeService('Fwitter <no-reply@fwitter.app>');
    expect(service.enabled).toBe(true);
    await service.send(message);
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toEqual({
      Source: 'Fwitter <no-reply@fwitter.app>',
      Destination: { ToAddresses: ['parent@example.com'] },
      Message: {
        Subject: { Data: 'Hello', Charset: 'UTF-8' },
        Body: { Text: { Data: 'plain', Charset: 'UTF-8' }, Html: { Data: '<p>html</p>', Charset: 'UTF-8' } },
      },
    });
  });
});
