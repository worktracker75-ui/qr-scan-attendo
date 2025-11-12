import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the requester is an admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, email, full_name, role } = await req.json();

    // Validate input
    if (!user_id || !email || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate password reset link
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
    }

    // Send credentials email
    try {
      const siteUrl = Deno.env.get("SITE_URL") || `${Deno.env.get("SUPABASE_URL")?.split('.')[0]?.replace('https://', 'https://') || ''}.lovable.app`;
      const loginUrl = `${siteUrl}/auth`;
      const resetLink = resetData?.properties?.action_link || loginUrl;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">QR Attendance System</h1>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Your Account Credentials</h2>
            <p style="color: #666; font-size: 16px;">Here are your account details for the QR Attendance System.</p>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #333;">Your Account Information:</h3>
              <p style="margin: 10px 0;"><strong style="color: #333;">Email:</strong> <span style="color: #667eea;">${email}</span></p>
              <p style="margin: 10px 0;"><strong style="color: #333;">Name:</strong> ${full_name || 'Not set'}</p>
              <p style="margin: 10px 0;"><strong style="color: #333;">Role:</strong> <span style="text-transform: capitalize; color: #10b981;">${role}</span></p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3); margin-bottom: 15px;">
                Login to Your Account
              </a>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0 0 10px 0; color: #92400e; font-size: 14px;">
                <strong>🔑 Need to reset your password?</strong>
              </p>
              <a href="${resetLink}" style="color: #667eea; text-decoration: underline; font-size: 14px;">
                Click here to set a new password
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">If the buttons above don't work, copy and paste these links into your browser:</p>
            <p style="background: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; color: #667eea; font-size: 13px; margin: 10px 0;"><strong>Login:</strong> ${loginUrl}</p>
            <p style="background: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all; color: #667eea; font-size: 13px;"><strong>Reset Password:</strong> ${resetLink}</p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
              This is an automated message from QR Attendance System. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          to: email,
          subject: "Your QR Attendance System Account Credentials",
          html: emailHtml,
        }),
      });
    } catch (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Credentials sent successfully"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
