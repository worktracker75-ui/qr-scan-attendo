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

    const newQrCodes = new Map();
    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);
      if (student) {
        const qrDataUrl = await generateQRForStudent(student.enrollment);
        newQrCodes.set(studentId, qrDataUrl);
      }
    }
    setQrCodes(newQrCodes);
    toast.success(`Generated ${newQrCodes.size} QR codes`);
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
              subject: "Your Attendance QR Code",
              html: `
                <h2>Hello ${student.name},</h2>
                <p>Your attendance QR code is attached to this email.</p>
                <p><strong>Enrollment:</strong> ${student.enrollment}</p>
                <p><strong>Roll Number:</strong> ${student.roll}</p>
                <p>Please use this QR code to mark your attendance in lab sessions.</p>
                <br>
                <p>Best regards,<br>Attendance System</p>
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

    for (const studentId of selectedStudents) {
      const student = students.find(s => s.id === studentId);

      if (student && student.email) {
        try {
          const { error } = await supabase.functions.invoke("send-email", {
            body: {
              to: student.email,
              subject: "Important Notification - Lab Attendance",
              html: `
                <h2>Hello ${student.name},</h2>
                <div style="background: #f0f9ff; padding: 20px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
                  <p style="margin: 0; font-size: 16px;">${notification}</p>
                </div>
                <p><strong>Enrollment:</strong> ${student.enrollment}</p>
                <p><strong>Section:</strong> ${student.section || "N/A"}</p>
                <br>
                <p>Best regards,<br>Attendance System</p>
              `,
            },
          });

          if (error) throw error;
          successCount++;
        } catch (error) {
          console.error(`Failed to send notification to ${student.email}:`, error);
        }
      }
    }

    setSending(false);
    setNotification("");
    toast.success(`Notification sent to ${successCount} students`);
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                  {Array.from(qrCodes.entries()).slice(0, 8).map(([studentId, qrUrl]) => {
                    const student = students.find(s => s.id === studentId);
                    return (
                      <div key={studentId} className="text-center">
                        <img src={qrUrl} alt="QR" className="w-full border rounded p-2 bg-white" />
                        <p className="text-xs mt-1 truncate">{student?.name}</p>
                      </div>
                    );
                  })}
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
