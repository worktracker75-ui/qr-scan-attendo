import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download } from "lucide-react";
import QRCode from "qrcode";

const GenerateQR = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [systemNo, setSystemNo] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");

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

  const generateQR = async () => {
    if (!selectedStudent || !systemNo) {
      toast.error("Please select a student and enter system number");
      return;
    }

    const student = students.find((s) => s.id === selectedStudent);
    if (!student) return;

    const qrPayload = {
      enrollment: student.enrollment,
      system_no: systemNo,
      signature: `${student.enrollment}-${systemNo}-${Date.now()}`,
    };

    try {
      const dataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 300,
        margin: 2,
      });
      setQrDataUrl(dataUrl);
      toast.success("QR code generated");
    } catch (error) {
      toast.error("Failed to generate QR code");
    }
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    
    const student = students.find((s) => s.id === selectedStudent);
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr_${student?.enrollment}_${systemNo}.png`;
    a.click();
    toast.success("QR code downloaded");
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
      <div className="container mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Generate QR Codes</CardTitle>
            <CardDescription>Create QR codes for students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Select Student</Label>
              <select
                id="student"
                className="w-full p-2 border rounded-md"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
              >
                <option value="">Select a student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} - {student.enrollment}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_no">System Number</Label>
              <Input
                id="system_no"
                value={systemNo}
                onChange={(e) => setSystemNo(e.target.value)}
                placeholder="PC-01"
              />
            </div>

            <Button onClick={generateQR} className="w-full">
              Generate QR Code
            </Button>

            {qrDataUrl && (
              <div className="space-y-4 mt-6">
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="QR Code" className="border rounded-lg p-4" />
                </div>
                <Button onClick={downloadQR} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Download QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GenerateQR;
