import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";

const Scanner = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [lastScanned, setLastScanned] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanner]);

  const startScanning = async () => {
    try {
      console.log("Starting QR scanner...");
      
      // Check if camera permissions are available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
          console.log("Camera permission granted");
        } catch (permError) {
          console.error("Camera permission error:", permError);
          toast.error("Camera permission denied. Please allow camera access.");
          return;
        }
      }

      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      );

      console.log("QR Scanner initialized, rendering...");
      qrScanner.render(onScanSuccess, onScanError);
      setScanner(qrScanner);
      setScanning(true);
      toast.success("Scanner started");
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      toast.error("Failed to start scanner: " + error.message);
    }
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.clear().catch(console.error);
      setScanner(null);
    }
    setScanning(false);
  };

  const onScanSuccess = async (decodedText: string) => {
    try {
      // QR now contains only enrollment number
      const enrollment = decodedText.trim();

      if (!enrollment) {
        toast.error("Invalid QR code format");
        return;
      }

      // Get student
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("*")
        .eq("enrollment", enrollment)
        .maybeSingle();

      if (studentError || !student) {
        toast.error("Student not found");
        return;
      }

      // Get active session
      const today = new Date().toISOString().split("T")[0];
      const currentTime = new Date().toTimeString().split(" ")[0].substring(0, 5);

      const { data: sessions, error: sessionError } = await supabase
        .from("sessions")
        .select("*")
        .eq("date", today)
        .lte("start_time", currentTime)
        .gte("end_time", currentTime);

      if (sessionError || !sessions || sessions.length === 0) {
        toast.error("No active session found");
        return;
      }

      const session = sessions[0];

      // Check if already marked
      const { data: existingAttendance } = await supabase
        .from("attendance")
        .select("*")
        .eq("student_id", student.id)
        .eq("session_id", session.id)
        .maybeSingle();

      if (existingAttendance) {
        toast.warning("Attendance already marked for this session");
        return;
      }

      // Mark attendance
      const { error: insertError } = await supabase.from("attendance").insert({
        student_id: student.id,
        session_id: session.id,
        system_no: student.system_no || "Not assigned",
        scanned_by: user?.id,
      });

      if (insertError) throw insertError;

      setLastScanned({
        name: student.name,
        enrollment: student.enrollment,
        roll: student.roll,
        section: student.section,
      });

      toast.success(`Attendance marked for ${student.name}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to process QR code");
    }
  };

  const onScanError = (error: any) => {
    // Ignore common scanning errors
    if (typeof error === 'string' && !error.includes("NotFoundException")) {
      console.error("QR Scan Error:", error);
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
      <div className="container mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>Scan student QR codes to mark attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!scanning ? (
              <Button onClick={startScanning} className="w-full" size="lg">
                <Camera className="mr-2 h-5 w-5" />
                Start Scanning
              </Button>
            ) : (
              <>
                <div id="qr-reader" className="w-full"></div>
                <Button onClick={stopScanning} variant="destructive" className="w-full">
                  Stop Scanning
                </Button>
              </>
            )}

            {lastScanned && (
              <Card className="bg-success/10 border-success">
                <CardHeader>
                  <CardTitle className="text-success">Last Scanned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <p><strong>Name:</strong> {lastScanned.name}</p>
                    <p><strong>Roll:</strong> {lastScanned.roll}</p>
                    <p><strong>Enrollment:</strong> {lastScanned.enrollment}</p>
                    <p><strong>Section:</strong> {lastScanned.section || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Scanner;
