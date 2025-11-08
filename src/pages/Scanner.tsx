import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Camera, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const Scanner = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);
  const [lastScanned, setLastScanned] = useState<any>(null);
  const [initScanner, setInitScanner] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [scannedDetails, setScannedDetails] = useState<any>(null);

  useEffect(() => {
    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [scanner]);

  useEffect(() => {
    if (initScanner && scanning) {
      initializeScanner();
      setInitScanner(false);
    }
  }, [initScanner, scanning]);

  const startScanning = async () => {
    try {
      console.log("Checking camera permissions...");
      
      // Check if browser supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Camera not supported on this device/browser");
        console.error("mediaDevices API not available");
        return;
      }

      // Request camera permission
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        console.log("Camera permission granted");
        
        // Stop the stream immediately as Html5QrcodeScanner will request it again
        stream.getTracks().forEach(track => track.stop());
      } catch (permError: any) {
        console.error("Camera permission error:", permError);
        if (permError.name === "NotAllowedError") {
          toast.error("Camera permission denied. Please allow camera access in browser settings.");
        } else if (permError.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else {
          toast.error("Camera access error: " + permError.message);
        }
        return;
      }

      // Set scanning to true first to render the DOM element
      setScanning(true);
      setInitScanner(true);
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      toast.error("Failed to start scanner: " + (error?.message || "Unknown error"));
    }
  };

  const initializeScanner = async () => {
    try {
      console.log("Initializing QR scanner...");
      
      // Wait a bit for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const qrScanner = new Html5QrcodeScanner(
        "qr-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          rememberLastUsedCamera: true,
        },
        false
      );

      console.log("QR Scanner initialized, rendering...");
      qrScanner.render(onScanSuccess, onScanError);
      setScanner(qrScanner);
      toast.success("Scanner started successfully!");
    } catch (error: any) {
      console.error("Error initializing scanner:", error);
      toast.error("Failed to initialize scanner: " + (error?.message || "Unknown error"));
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scanner) {
      scanner.clear().catch(console.error);
      setScanner(null);
    }
    setScanning(false);
  };

  const clearSession = () => {
    setLastScanned(null);
    setScannedDetails(null);
    toast.success("Session cleared");
  };

  const handleDialogClose = () => {
    setShowDetailsDialog(false);
    setScannedDetails(null);
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

      // Show dialog with details
      setScannedDetails({
        name: student.name,
        roll: student.roll,
        enrollment: student.enrollment,
        section: student.section || "N/A",
        labNo: session.lab_no,
        pcNo: student.system_no || "Not assigned",
        status: "Present",
      });
      setShowDetailsDialog(true);

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
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/sessions")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Attendance
            </Button>
            {lastScanned && (
              <Button variant="outline" onClick={clearSession}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear Session
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>Scan student QR codes to mark attendance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!scanning ? (
              <>
                <div className="bg-muted/50 p-4 rounded-lg mb-4 space-y-2">
                  <p className="text-sm font-medium">Before scanning:</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Allow camera permission when prompted</li>
                    <li>Ensure good lighting</li>
                    <li>Hold QR code steady within the frame</li>
                  </ul>
                </div>
                <Button onClick={startScanning} className="w-full" size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Start Scanning
                </Button>
              </>
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

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-6 w-6" />
              Attendance Marked Successfully
            </DialogTitle>
            <DialogDescription>
              Student details and attendance status
            </DialogDescription>
          </DialogHeader>
          {scannedDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-semibold">{scannedDetails.name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Roll No.</p>
                  <p className="font-semibold">{scannedDetails.roll}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Enrollment</p>
                  <p className="font-semibold">{scannedDetails.enrollment}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Section</p>
                  <p className="font-semibold">{scannedDetails.section}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Lab No.</p>
                  <p className="font-semibold">{scannedDetails.labNo}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">PC No.</p>
                  <p className="font-semibold">{scannedDetails.pcNo}</p>
                </div>
              </div>
              <div className="bg-success/10 border border-success/20 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Attendance Status</p>
                <p className="text-2xl font-bold text-success">{scannedDetails.status}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleDialogClose} className="w-full" size="lg">
              OK - Continue Scanning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Scanner;
