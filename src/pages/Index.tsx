import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QrCode, Users, Calendar, FileText } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-hover to-accent">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center text-white mb-16">
          <div className="flex justify-center mb-6">
            <div className="bg-white/20 backdrop-blur-sm p-6 rounded-2xl">
              <QrCode className="h-16 w-16" />
            </div>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            QR Attendance System
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            Streamline your attendance tracking with secure QR code scanning
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/auth")}
            className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6"
          >
            Get Started
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white">
            <Users className="h-12 w-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Student Management</h3>
            <p className="text-white/80">Upload and manage student data via CSV with validation</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white">
            <Calendar className="h-12 w-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Session Control</h3>
            <p className="text-white/80">Create and manage lab sessions with time tracking</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-xl text-white">
            <FileText className="h-12 w-12 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Export Reports</h3>
            <p className="text-white/80">Generate attendance reports in CSV and PDF formats</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
