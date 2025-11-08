import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: string;
  }[];
}

async function sendSMTPEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
) {
  const smtpEmail = Deno.env.get("SMTP_EMAIL");
  const smtpPassword = Deno.env.get("SMTP_APP_PASSWORD");

  if (!smtpEmail || !smtpPassword) {
    throw new Error("SMTP credentials not configured");
  }

  console.log(`Connecting to Gmail SMTP for ${to}...`);

  // Use port 465 with implicit TLS (more reliable than STARTTLS)
  const conn = await Deno.connectTls({
    hostname: "smtp.gmail.com",
    port: 465,
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Helper function to read SMTP response
  async function readResponse(): Promise<string> {
    const buffer = new Uint8Array(4096);
    const n = await conn.read(buffer);
    if (!n) throw new Error("Connection closed");
    const response = decoder.decode(buffer.subarray(0, n));
    console.log("SMTP:", response.trim());
    return response;
  }

  // Helper function to send SMTP command
  async function sendCommand(command: string): Promise<string> {
    console.log("Sending:", command.trim());
    await conn.write(encoder.encode(command));
    return await readResponse();
  }

  try {
    // Read initial greeting
    await readResponse();

    // EHLO
    await sendCommand(`EHLO localhost\r\n`);

    // AUTH LOGIN
    await sendCommand(`AUTH LOGIN\r\n`);
    await sendCommand(`${btoa(smtpEmail)}\r\n`);
    await sendCommand(`${btoa(smtpPassword)}\r\n`);

    // MAIL FROM
    await sendCommand(`MAIL FROM:<${smtpEmail}>\r\n`);

    // RCPT TO
    await sendCommand(`RCPT TO:<${to}>\r\n`);

    // DATA
    await sendCommand(`DATA\r\n`);

    // Build email with attachments
    const boundary = "----=_Part_" + Date.now();
    let emailBody = "";
    emailBody += `From: Skill Quiz Lab <${smtpEmail}>\r\n`;
    emailBody += `To: ${to}\r\n`;
    emailBody += `Subject: ${subject}\r\n`;
    emailBody += `MIME-Version: 1.0\r\n`;
    emailBody += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    // HTML content
    emailBody += `--${boundary}\r\n`;
    emailBody += `Content-Type: text/html; charset=UTF-8\r\n`;
    emailBody += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
    emailBody += `${html}\r\n\r\n`;

    // Attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        emailBody += `--${boundary}\r\n`;
        emailBody += `Content-Type: image/png; name="${attachment.filename}"\r\n`;
        emailBody += `Content-Transfer-Encoding: base64\r\n`;
        emailBody += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
        
        // Split base64 into 76-character lines as per RFC
        const content = attachment.content.match(/.{1,76}/g)?.join("\r\n") || attachment.content;
        emailBody += `${content}\r\n\r\n`;
      }
    }

    emailBody += `--${boundary}--\r\n`;

    // Send email body and end with CRLF.CRLF
    await conn.write(encoder.encode(emailBody + "\r\n.\r\n"));
    const dataResponse = await readResponse();

    if (!dataResponse.startsWith("250")) {
      throw new Error(`Failed to send email: ${dataResponse}`);
    }

    // QUIT
    await sendCommand(`QUIT\r\n`);

    conn.close();
    console.log("Email sent successfully to", to);
  } catch (error) {
    conn.close();
    throw error;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments }: EmailRequest = await req.json();

    await sendSMTPEmail(to, subject, html, attachments);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
