import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, QrCode, Calendar, FileText, LogOut } from "lucide-react";

const Dashboard = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const menuItems = [
    {
      title: "Upload Students",
      description: "Import student data from CSV",
      icon: Users,
      path: "/students",
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Manage Sessions",
      description: "Create and view lab sessions",
      icon: Calendar,
      path: "/sessions",
      color: "bg-accent/10 text-accent",
    },
    {
      title: "Scan QR",
      description: "Mark attendance by scanning QR codes",
      icon: QrCode,
      path: "/scanner",
      color: "bg-secondary/10 text-secondary",
    },
    {
      title: "View Attendance",
      description: "View and export attendance records",
      icon: FileText,
      path: "/attendance",
      color: "bg-success/10 text-success",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">QR Attendance System</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Role: <span className="font-semibold text-foreground">{userRole?.role || "Loading..."}</span>
            </p>
          </div>
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.path}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                onClick={() => navigate(item.path)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg ${item.color} flex items-center justify-center mb-2`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full">
                    Open →
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
