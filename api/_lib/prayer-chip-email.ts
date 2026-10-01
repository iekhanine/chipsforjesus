type GiftEmailInput = {
  orderId: string
  to: string
  recipientName?: string | null
  quantity: number
}

type GiftEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; error: string }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[char] || char
  })
}

function siteUrl() {
  return (process.env.C4J_SITE_URL || 'https://chipsforjesus.com').replace(/\/$/, '')
}

function senderAddress() {
  return (
    process.env.C4J_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.NOTIFICATION_FROM_EMAIL ||
    'Chips for Jesus <prayer@chipsforjesus.com>'
  )
}

function quantityLabel(quantity: number) {
  return quantity === 1 ? '1 Prayer Chip' : `${quantity.toLocaleString('en-US')} Prayer Chips`
}

export async function sendPrayerChipGiftEmail(input: GiftEmailInput): Promise<GiftEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY is not configured.' }
  }

  const quantity = Math.max(1, Math.floor(input.quantity))
  const chips = quantityLabel(quantity)
  const recipientName = input.recipientName?.trim() || ''
  const greeting = recipientName ? `Hi ${escapeHtml(recipientName)},` : 'Hi there,'
  const membersUrl = `${siteUrl()}/members`
  const safeTo = escapeHtml(input.to)
  const subject = quantity === 1 ? 'You received a Prayer Chip' : `You received ${quantity.toLocaleString('en-US')} Prayer Chips`

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f6f1e7;color:#231f1a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">You were given ${escapeHtml(chips)} through Chips for Jesus.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f1e7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dfd5c4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:34px 38px 18px;text-align:center;background:#17130f;color:#ffffff;">
                <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#d8b46a;font-weight:700;">Chips for Jesus</div>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.2;">Someone gave you a prayer.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 38px;">
                <p style="margin:0 0 18px;font-size:17px;line-height:1.6;">${greeting}</p>
                <p style="margin:0 0 18px;font-size:17px;line-height:1.6;">You were given <strong>${escapeHtml(chips)}</strong> through Chips for Jesus.</p>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#554d43;">Each Prayer Chip represents a prayer waiting to be prayed for you. This is a gift. You were not charged anything, and there is nothing you need to buy.</p>
                <div style="text-align:center;margin:28px 0;">
                  <a href="${membersUrl}" style="display:inline-block;background:#b5852f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 24px;border-radius:9px;">View Your Prayer Chips</a>
                </div>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#554d43;">Sign in using <strong>${safeTo}</strong>. If you do not have an account yet, create one with that same email address and the chips will attach automatically.</p>
                <p style="margin:22px 0 0;font-size:14px;line-height:1.6;color:#7a7167;">If you were not expecting this email, you can simply ignore it. No payment was made and no subscription was created.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 38px 30px;text-align:center;border-top:1px solid #eee6da;color:#7a7167;font-size:13px;line-height:1.6;">
                Chips for Jesus<br />
                <a href="${siteUrl()}" style="color:#8a6425;">chipsforjesus.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    recipientName ? `Hi ${recipientName},` : 'Hi there,',
    '',
    `You were given ${chips} through Chips for Jesus.`,
    '',
    'Each Prayer Chip represents a prayer waiting to be prayed for you. This is a gift. You were not charged anything, and there is nothing you need to buy.',
    '',
    `View your Prayer Chips: ${membersUrl}`,
    '',
    `Sign in using ${input.to}. If you do not have an account yet, create one with that same email address and the chips will attach automatically.`,
    '',
    'If you were not expecting this email, you can simply ignore it. No payment was made and no subscription was created.',
    '',
    'Chips for Jesus',
    siteUrl(),
  ].join('\n')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `c4j-prayer-chip-gift-${input.orderId}`,
      },
      body: JSON.stringify({
        from: senderAddress(),
        to: [input.to],
        subject,
        html,
        text,
        ...((process.env.C4J_REPLY_TO_EMAIL || process.env.RESEND_REPLY_TO_EMAIL)?.trim()
          ? { reply_to: (process.env.C4J_REPLY_TO_EMAIL || process.env.RESEND_REPLY_TO_EMAIL)!.trim() }
          : {}),
      }),
    })

    const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } }

    if (!response.ok) {
      const message = payload?.message || payload?.error?.message || `Resend returned ${response.status}.`
      return { sent: false, error: message }
    }

    return { sent: true, id: payload.id || null }
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Email could not be sent.',
    }
  }
}
