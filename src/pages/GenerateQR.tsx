import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Mail, Send } from "lucide-react";
import QRCode from "qrcode";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const GenerateQR = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [qrCodes, setQrCodes] = useState<Map<string, string>>(new Map());
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState("");

  useEffect(() => {
    if (user) {
      fetchStudents();
    }
  }, [user]);

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("name");

    if (error) {
      toast.error("Failed to load students");
    } else {
      setStudents(data || []);
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.id));
    }
  };

  const generateQRForStudent = async (enrollment: string): Promise<string> => {
    try {
      const dataUrl = await QRCode.toDataURL(enrollment, {
        width: 300,
        margin: 2,
      });
      return dataUrl;
    } catch (error) {
      throw new Error("Failed to generate QR code");
    }
  };

  const generateQRs = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select at least one student");
      return;
    }

    try {
      toast.info("Generating QR codes...");
      const newQrCodes = new Map();
      
      for (const studentId of selectedStudents) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          console.log("Generating QR for:", student.enrollment);
          const qrDataUrl = await generateQRForStudent(student.enrollment);
          console.log("Generated QR data URL length:", qrDataUrl.length);
          newQrCodes.set(studentId, qrDataUrl);
        }
      }
      
      console.log("Total QR codes generated:", newQrCodes.size);
      setQrCodes(newQrCodes);
      toast.success(`Generated ${newQrCodes.size} QR codes`);
    } catch (error: any) {
      console.error("Error generating QR codes:", error);
      toast.error("Failed to generate QR codes: " + error.message);
    }
  };

  const sendQRsViaEmail = async () => {
    if (selectedStudents.length === 0) {
      toast.error("Please select students first");
      return;
    }

    if (qrCodes.size === 0) {
      toast.error("Please generate QR codes first");
      return;
    }

    setSending(true);
    let successCount = 0;

    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);
      const qrDataUrl = qrCodes.get(studentId);

      if (student && student.email && qrDataUrl) {
        try {
          const base64Data = qrDataUrl.split(",")[1];
          
          const { error } = await supabase.functions.invoke("send-email", {
            body: {
              to: student.email,
              subject: "🎯 Your Personal Attendance QR Code - Skill Quiz Lab",
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                    .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
                    .content { padding: 40px 30px; }
                    .greeting { font-size: 22px; font-weight: 600; color: #667eea; margin-bottom: 20px; }
                    .info-box { background: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0; border-radius: 6px; }
                    .info-item { margin: 10px 0; font-size: 15px; }
                    .info-item strong { color: #667eea; display: inline-block; width: 120px; }
                    .qr-notice { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 6px; color: #856404; }
                    .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
                    .footer p { margin: 5px 0; color: #6c757d; font-size: 14px; }
                    .highlight { background: linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%); padding: 2px 8px; border-radius: 4px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🎓 Skill Quiz Lab</h1>
                      <p>Smart Attendance Management System</p>
                    </div>
                    <div class="content">
                      <div class="greeting">Hello ${student.name}! 👋</div>
                      <p>We are excited to share your <span class="highlight">personal attendance QR code</span>! This unique code is attached to this email and will be used to mark your presence in all lab sessions.</p>
                      
                      <div class="info-box">
                        <div class="info-item"><strong>📋 Enrollment:</strong> ${student.enrollment}</div>
                        <div class="info-item"><strong>🎫 Roll Number:</strong> ${student.roll}</div>
                        <div class="info-item"><strong>👤 Name:</strong> ${student.name}</div>
                      </div>

                      <div class="qr-notice">
                        <strong>⚠️ Important:</strong> Please save this QR code on your mobile device. Show it to the instructor during lab sessions to mark your attendance quickly and efficiently.
                      </div>

                      <p style="margin-top: 30px; font-size: 15px; color: #666;">If you have any questions or face any issues, please contact your lab instructor immediately.</p>
                    </div>
                    <div class="footer">
                      <p style="font-weight: 600; color: #667eea; margin-bottom: 10px;">Skill Quiz Lab</p>
                      <p>Building Skills, One Quiz at a Time 🚀</p>
                      <p style="margin-top: 15px; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
                    </div>
                  </div>
                </body>
                </html>
              `,
              attachments: [{
                filename: `qr_${student.enrollment}.png`,
                content: base64Data,
              }],
            },
          });

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Failed to send email to ${student.email}:`, error);
        }
      }
    }

    setSending(false);
    toast.success(`QR codes sent to ${successCount} students`);
  };

  const sendNotification = async () => {
    if (!notification.trim()) {
      toast.error("Please enter a notification message");
      return;
    }

    if (selectedStudents.length === 0) {
      toast.error("Please select students first");
      return;
    }

    setSending(true);
    let successCount = 0;
    let noEmailCount = 0;
    let failedCount = 0;

    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);

      if (!student) continue;

      if (!student.email || student.email.trim() === "") {
        console.log(`Student ${student.name} has no email address`);
        noEmailCount++;
        continue;
      }

      try {
        console.log(`Sending notification to ${student.email}...`);
        const { data, error } = await supabase.functions.invoke("send-email", {
          body: {
            to: student.email,
            subject: "📢 Important Lab Notification - Skill Quiz Lab",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
                  .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
                  .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
                  .header p { margin: 10px 0 0; font-size: 16px; opacity: 0.9; }
                  .content { padding: 40px 30px; }
                  .greeting { font-size: 22px; font-weight: 600; color: #667eea; margin-bottom: 20px; }
                  .notification-box { background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-left: 5px solid #667eea; padding: 25px; margin: 25px 0; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
                  .notification-box p { margin: 0; font-size: 16px; font-weight: 500; color: #2d3748; line-height: 1.8; }
                  .info-box { background: #f8f9ff; padding: 20px; margin: 25px 0; border-radius: 6px; border: 1px solid #e8ebff; }
                  .info-item { margin: 10px 0; font-size: 15px; }
                  .info-item strong { color: #667eea; display: inline-block; width: 100px; }
                  .footer { background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef; }
                  .footer p { margin: 5px 0; color: #6c757d; font-size: 14px; }
                  .alert-icon { font-size: 32px; margin-bottom: 10px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎓 Skill Quiz Lab</h1>
                    <p>Smart Attendance Management System</p>
                  </div>
                  <div class="content">
                    <div class="alert-icon">📢</div>
                    <div class="greeting">Hello ${student.name}! 👋</div>
                    <p style="margin-bottom: 20px;">We have an important update for you:</p>
                    
                    <div class="notification-box">
                      <p>${notification}</p>
                    </div>

                    <div class="info-box">
                      <div class="info-item"><strong>📋 Enrollment:</strong> ${student.enrollment}</div>
                      <div class="info-item"><strong>📚 Section:</strong> ${student.section || "N/A"}</div>
                    </div>

                    <p style="margin-top: 30px; font-size: 15px; color: #666;">Please take note of this information and act accordingly. For any queries, contact your lab instructor.</p>
                  </div>
                  <div class="footer">
                    <p style="font-weight: 600; color: #667eea; margin-bottom: 10px;">Skill Quiz Lab</p>
                    <p>Building Skills, One Quiz at a Time 🚀</p>
                    <p style="margin-top: 15px; font-size: 12px; color: #999;">This is an automated message. Please do not reply to this email.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          },
        });

        if (error) {
          console.error(`Error response for ${student.email}:`, error);
          failedCount++;
        } else {
          console.log(`Successfully sent to ${student.email}`, data);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to send notification to ${student.email}:`, error);
        failedCount++;
      }
    }

    setSending(false);
    setNotification("");
    
    if (successCount > 0) {
      toast.success(`Notification sent to ${successCount} students`);
    }
    if (noEmailCount > 0) {
      toast.warning(`${noEmailCount} students have no email address`);
    }
    if (failedCount > 0) {
      toast.error(`Failed to send to ${failedCount} students. Check console for details.`);
    }
    if (successCount === 0 && noEmailCount === 0 && failedCount === 0) {
      toast.error("No emails were sent");
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6">
      <div className="container mx-auto max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Student QR Code Management</CardTitle>
              <CardDescription>
                Generate and send QR codes to students via email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Selected:</strong> {selectedStudents.length} of {students.length} students
                </p>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={generateQRs} 
                  disabled={selectedStudents.length === 0}
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  1. Generate QR Codes ({selectedStudents.length})
                </Button>
                <Button
                  onClick={sendQRsViaEmail}
                  disabled={selectedStudents.length === 0 || qrCodes.size === 0 || sending}
                  variant="default"
                  size="lg"
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {sending ? "Sending..." : `2. Send to ${selectedStudents.length} Email(s)`}
                </Button>
              </div>

              {qrCodes.size > 0 && (
                <div className="space-y-4">
                  <div className="bg-success/10 p-3 rounded border border-success/20">
                    <p className="text-sm font-medium text-success">
                      ✓ {qrCodes.size} QR code(s) generated successfully
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                    {Array.from(qrCodes.entries()).map(([studentId, qrUrl]) => {
                      const student = students.find(s => s.id === studentId);
                      return (
                        <div key={studentId} className="text-center space-y-2">
                          <img 
                            src={qrUrl} 
                            alt={`QR code for ${student?.name}`}
                            className="w-full border-2 border-border rounded p-2 bg-white" 
                          />
                          <div className="text-xs space-y-1">
                            <p className="font-medium truncate">{student?.name}</p>
                            <p className="text-muted-foreground">{student?.enrollment}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send Notification</CardTitle>
              <CardDescription>
                Send notifications to selected students
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification">Message</Label>
                <Input
                  id="notification"
                  value={notification}
                  onChange={(e) => setNotification(e.target.value)}
                  placeholder="e.g., Quiz tomorrow at 10 AM in Lab 3"
                />
              </div>
              <Button
                onClick={sendNotification}
                disabled={selectedStudents.length === 0 || sending}
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? "Sending..." : "Send Notification"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Students List</CardTitle>
                  <CardDescription>
                    Select students to generate QR codes or send notifications
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedStudents.length === students.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Roll</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Enrollment</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Section</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => toggleStudent(student.id)}
                          />
                        </TableCell>
                        <TableCell>{student.roll}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.enrollment}</TableCell>
                        <TableCell>{student.email || "N/A"}</TableCell>
                        <TableCell>{student.section || "N/A"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default GenerateQR;
