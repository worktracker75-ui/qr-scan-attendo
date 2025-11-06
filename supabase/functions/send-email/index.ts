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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, attachments }: EmailRequest = await req.json();
    
    const smtpEmail = Deno.env.get("SMTP_EMAIL");
    const smtpPassword = Deno.env.get("SMTP_APP_PASSWORD");

    if (!smtpEmail || !smtpPassword) {
      throw new Error("SMTP credentials not configured");
    }

    console.log(`Sending email to ${to} from ${smtpEmail}`);

    // Create email body with attachments
    const boundary = "----=_Part_" + Date.now();
    let emailBody = `From: ${smtpEmail}\r\n`;
    emailBody += `To: ${to}\r\n`;
    emailBody += `Subject: ${subject}\r\n`;
    emailBody += `MIME-Version: 1.0\r\n`;
    emailBody += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
    
    // HTML content
    emailBody += `--${boundary}\r\n`;
    emailBody += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
    emailBody += `${html}\r\n\r\n`;
    
    // Attachments
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        emailBody += `--${boundary}\r\n`;
        emailBody += `Content-Type: image/png; name="${attachment.filename}"\r\n`;
        emailBody += `Content-Transfer-Encoding: base64\r\n`;
        emailBody += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
        emailBody += `${attachment.content}\r\n\r\n`;
      }
    }
    
    emailBody += `--${boundary}--`;

    // Send email via Gmail SMTP
    const response = await fetch("https://smtp.gmail.com:587", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${smtpEmail}:${smtpPassword}`)}`,
        "Content-Type": "text/plain",
      },
      body: emailBody,
    });

    // Alternative: Use Deno's SMTP connection
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    const conn = await Deno.connect({
      hostname: "smtp.gmail.com",
      port: 587,
      transport: "tcp",
    });

    // Send SMTP commands
    const commands = [
      `EHLO localhost\r\n`,
      `STARTTLS\r\n`,
      `AUTH LOGIN\r\n`,
      `${btoa(smtpEmail)}\r\n`,
      `${btoa(smtpPassword)}\r\n`,
      `MAIL FROM:<${smtpEmail}>\r\n`,
      `RCPT TO:<${to}>\r\n`,
      `DATA\r\n`,
      `${emailBody}\r\n.\r\n`,
      `QUIT\r\n`,
    ];

    for (const command of commands) {
      await conn.write(encoder.encode(command));
      const buffer = new Uint8Array(1024);
      await conn.read(buffer);
      const response = decoder.decode(buffer);
      console.log("SMTP Response:", response);
      
      if (response.startsWith("5")) {
        throw new Error(`SMTP error: ${response}`);
      }
    }

    conn.close();

    console.log("Email sent successfully");

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
