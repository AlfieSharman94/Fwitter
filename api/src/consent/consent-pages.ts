// The guardian-facing side of consent: the email and the three HTML pages the link opens.
// Plain strings on purpose; a view engine would be more than this needs.

const APP_NAME = 'Fwitter';

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #0d0d0d; color: #e8e8e8; font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 520px; margin: 0 auto; padding: 32px 20px 48px; }
  .brand { color: #00c853; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-size: 13px; margin-bottom: 20px; }
  h1 { font-size: 26px; margin: 0 0 12px; color: #fff; }
  p { font-size: 16px; line-height: 1.5; margin: 0 0 16px; }
  form { margin: 24px 0 0; }
  button { width: 100%; padding: 15px; border-radius: 12px; border: 0; font-size: 17px; font-weight: 700; cursor: pointer; }
  .confirm { background: #00c853; color: #06210f; }
  .decline { background: transparent; color: #ea3333; border: 2px solid #ea3333; }
  label { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: #9a9a9a; margin-top: 12px; }
  .muted { color: #9a9a9a; font-size: 14px; margin-top: 24px; }
</style>
</head>
<body><main><div class="brand">${APP_NAME}</div>
${body}
</main></body>
</html>`;
}

// The page behind the emailed link. Only the two POST buttons change anything, so a mail
// scanner that prefetches the link cannot consume it.
export function reviewPage(input: { username: string; token: string }): string {
  const u = escapeHtml(input.username);
  const base = `/consent/${encodeURIComponent(input.token)}`;
  return layout(
    'Confirm consent',
    `<h1>@${u} wants to join ${APP_NAME}</h1>
<p>${APP_NAME} is a football discussion app for under-16s. @${u} said they are between 13 and 15 and gave your email address as their parent or guardian's.</p>
<p>Accounts in this age group get: posts other members can see, private messages only with people who follow them back and are in the same age group, a word filter and image checks, and human moderation. No ads, no location, no tracking.</p>
<p>Until you confirm, the account cannot be used.</p>
<form method="post" action="${base}/confirm"><button class="confirm" type="submit">Yes, I give my consent</button></form>
<form method="post" action="${base}/decline">
<button class="decline" type="submit">No, delete the account</button>
<label><input type="checkbox" name="understand" required> I understand this permanently deletes @${u}'s account and everything they have posted.</label>
</form>
<p class="muted">This link works once and expires 7 days after it was sent. If you did not expect this email, you can ignore it; the account stays locked.</p>`,
  );
}

export type MessageKind = 'confirmed' | 'deleted' | 'expired' | 'invalid' | 'error';

export function messagePage(kind: MessageKind): string {
  const copy: Record<MessageKind, { title: string; body: string }> = {
    confirmed: {
      title: 'Thanks, consent confirmed',
      body: 'The account is now active. If the app still shows the waiting screen, ask your child to tap "Check again".',
    },
    deleted: { title: 'Account deleted', body: 'The account and everything it posted have been removed.' },
    expired: { title: 'This link has expired', body: 'Consent links work for 7 days. Ask your child to send a new one from the app.' },
    invalid: {
      title: 'This link is no longer valid',
      body: 'It may already have been used, or the account no longer exists. If your child still needs consent, ask them to send a new link from the app.',
    },
    error: { title: 'Something went wrong', body: 'Nothing was changed. Please try the link again in a few minutes.' },
  };
  const c = copy[kind];
  return layout(c.title, `<h1>${escapeHtml(c.title)}</h1>\n<p>${escapeHtml(c.body)}</p>`);
}

export function consentEmail(input: { username: string; link: string }): { subject: string; text: string; html: string } {
  const u = input.username;
  const subject = `${APP_NAME}: confirm @${u} can use the app`;
  const paragraphs = [
    'Hi,',
    `@${u} has signed up to ${APP_NAME}, a football discussion app for under-16s, and gave this address as their parent or guardian's email.`,
    `${APP_NAME} is for ages 13 and up. Junior accounts (13 to 15) can post about football and message only people who follow them back in the same age group. Posts go through a word filter and image checks, and there is human moderation. No ads, no location, no tracking.`,
    'To let them use the app, open this link and tap Confirm:',
    input.link,
    `If you don't want them to use ${APP_NAME}, the same page lets you delete the account.`,
    "The link works once and expires in 7 days. If you weren't expecting this email, you can ignore it: the account stays locked until a guardian confirms.",
  ];
  const text = paragraphs.join('\n\n');
  const html = paragraphs
    .map((p) => (p === input.link ? `<p><a href="${escapeHtml(p)}">${escapeHtml(p)}</a></p>` : `<p>${escapeHtml(p)}</p>`))
    .join('\n');
  return { subject, text, html };
}
