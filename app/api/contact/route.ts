import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO_EMAIL = 'leboutiqueart@gmail.com'
const FROM_EMAIL = 'MUSE <onboarding@resend.dev>'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type } = body

    if (type === 'contact') {
      const { name, email, subject, message } = body
      if (!name || !email || !message) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
      }

      await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        replyTo: email,
        subject: subject || `New message from ${name}`,
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="font-size: 24px; font-weight: 400; border-bottom: 1px solid #e8e8e4; padding-bottom: 12px;">
              New Contact from Le Boutique Art
            </h2>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject || '—'}</p>
            <div style="margin-top: 16px; padding: 16px; background: #f7f6f3; border-left: 2px solid #c9a84c;">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
          </div>
        `,
      })

      return NextResponse.json({ success: true })
    }

    if (type === 'transcript') {
      const { messages, visitorEmail } = body
      if (!messages || !Array.isArray(messages)) {
        return NextResponse.json({ error: 'Missing messages' }, { status: 400 })
      }

      const chatHtml = messages
        .map((m: { role: string; content: string }) => {
          const isUser = m.role === 'user'
          return `
            <div style="margin-bottom: 12px; text-align: ${isUser ? 'right' : 'left'};">
              <span style="display: inline-block; max-width: 80%; padding: 10px 14px;
                background: ${isUser ? '#1a1a1a' : '#f7f6f3'};
                color: ${isUser ? '#ffffff' : '#1a1a1a'};
                border-radius: 2px; font-size: 14px; line-height: 1.5;">
                <strong style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; opacity: 0.6;">
                  ${isUser ? 'Visitor' : 'MUSE'}
                </strong><br/>
                ${m.content.replace(/\n/g, '<br/>')}
              </span>
            </div>
          `
        })
        .join('')

      await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        replyTo: visitorEmail || TO_EMAIL,
        subject: 'MUSE Chat Transcript — Le Boutique Art',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            <h2 style="font-size: 24px; font-weight: 400; border-bottom: 1px solid #e8e8e4; padding-bottom: 12px;">
              MUSE Chat Transcript
            </h2>
            ${visitorEmail ? `<p style="color: #888884; font-size: 13px;">Visitor email: <a href="mailto:${visitorEmail}">${visitorEmail}</a></p>` : ''}
            <div style="margin-top: 16px;">${chatHtml}</div>
          </div>
        `,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error('Contact API error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
