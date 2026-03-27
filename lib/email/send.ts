import { sql } from "@/lib/db"
import { generateReplyToAddress, generateMessageId } from "./threading"
import { substituteVariables } from "./templates"

interface EmailRecipient {
  email: string
  name?: string
}

interface SendTicketEmailParams {
  ticketId: string
  ticketNumber: string
  toAddresses: EmailRecipient[]
  ccAddresses?: EmailRecipient[]
  subject: string
  bodyText: string
  bodyHtml?: string
  templateId?: string
  sentById: string
  sentByName: string
  sentByEmail: string
}

interface SendEmailResult {
  success: boolean
  emailMessageId?: string
  ticketResponseId?: string
  resendEmailId?: string
  error?: string
}

/**
 * Send an email from a ticket and record it in the database.
 * Creates both an email_messages record and a ticket_response.
 */
export async function sendTicketEmail(params: SendTicketEmailParams): Promise<SendEmailResult> {
  const {
    ticketId, ticketNumber, toAddresses, ccAddresses,
    subject, bodyText, bodyHtml, templateId,
    sentById, sentByName, sentByEmail,
  } = params

  const replyToAddress = generateReplyToAddress(ticketId)

  // Ensure subject includes ticket number prefix
  const finalSubject = subject.includes(ticketNumber)
    ? subject
    : `[${ticketNumber}] ${subject}`

  try {
    // 1. Create email_messages record
    const [emailMessage] = await sql`
      INSERT INTO email_messages (
        ticket_id, direction, from_address, from_name,
        to_addresses, cc_addresses, reply_to_address,
        subject, body_text, body_html,
        template_id, status, sent_by_id, sent_by_name
      ) VALUES (
        ${ticketId}, 'outbound', ${sentByEmail}, ${sentByName},
        ${JSON.stringify(toAddresses)}, ${JSON.stringify(ccAddresses || [])},
        ${replyToAddress},
        ${finalSubject}, ${bodyText}, ${bodyHtml || null},
        ${templateId || null}, 'queued', ${sentById}, ${sentByName}
      )
      RETURNING *
    `

    // 2. Set Message-ID
    const messageId = generateMessageId(emailMessage.id)
    await sql`
      UPDATE email_messages SET message_id = ${messageId} WHERE id = ${emailMessage.id}
    `

    // 3. Create ticket_response linked to the email
    const toNames = toAddresses.map((a) => a.name || a.email).join(", ")
    const responseBody = `📧 Email sent to ${toNames}\n\nSubject: ${finalSubject}\n\n${bodyText}`

    const [ticketResponse] = await sql`
      INSERT INTO ticket_responses (
        ticket_id, response_type, body,
        created_by_id, created_by_name, created_by_role,
        email_message_id
      ) VALUES (
        ${ticketId}, 'email_outbound', ${responseBody},
        ${sentById}, ${sentByName}, 'Ensuredit',
        ${emailMessage.id}
      )
      RETURNING *
    `

    // 4. Link response back to email message
    await sql`
      UPDATE email_messages
      SET ticket_response_id = ${ticketResponse.id}
      WHERE id = ${emailMessage.id}
    `

    // 5. Create ticket history entry
    await sql`
      INSERT INTO ticket_history (
        ticket_id, user_id, user_name, action, field_name, new_value
      ) VALUES (
        ${ticketId}, ${sentById}, ${sentByName}, 'email_sent',
        'email', ${`Sent to ${toNames}: ${finalSubject}`}
      )
    `

    // 6. Update ticket updated_at
    await sql`
      UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ${ticketId}
    `

    // 7. Send via Resend API
    const resendApiKey = process.env.RESEND_API_KEY
    if (resendApiKey) {
      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${sentByName} <${sentByEmail}>`,
            to: toAddresses.map((a) => a.email),
            cc: ccAddresses?.map((a) => a.email) || [],
            reply_to: replyToAddress,
            subject: finalSubject,
            text: bodyText,
            html: bodyHtml || undefined,
            headers: {
              "Message-ID": messageId,
            },
          }),
        })

        if (resendResponse.ok) {
          const resendData = await resendResponse.json()
          await sql`
            UPDATE email_messages
            SET status = 'sent', resend_email_id = ${resendData.id}, sent_at = CURRENT_TIMESTAMP
            WHERE id = ${emailMessage.id}
          `
          return {
            success: true,
            emailMessageId: emailMessage.id,
            ticketResponseId: ticketResponse.id,
            resendEmailId: resendData.id,
          }
        } else {
          const errorData = await resendResponse.text()
          await sql`
            UPDATE email_messages SET status = 'failed' WHERE id = ${emailMessage.id}
          `
          return {
            success: false,
            emailMessageId: emailMessage.id,
            error: `Resend API error: ${errorData}`,
          }
        }
      } catch (sendError: any) {
        await sql`
          UPDATE email_messages SET status = 'failed' WHERE id = ${emailMessage.id}
        `
        return {
          success: false,
          emailMessageId: emailMessage.id,
          error: `Send failed: ${sendError.message}`,
        }
      }
    } else {
      // No Resend API key — mark as sent (dev/demo mode)
      await sql`
        UPDATE email_messages
        SET status = 'sent', sent_at = CURRENT_TIMESTAMP
        WHERE id = ${emailMessage.id}
      `
      return {
        success: true,
        emailMessageId: emailMessage.id,
        ticketResponseId: ticketResponse.id,
      }
    }
  } catch (error: any) {
    console.error("sendTicketEmail error:", error)
    return { success: false, error: error.message }
  }
}
