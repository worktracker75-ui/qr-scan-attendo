import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, QrCode, Calendar, FileText, LogOut, Database, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const { user, userRole, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "employee",
  });

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

  const handleResetDatabase = async () => {
    setResetting(true);
    try {
      // Delete data from attendance, sessions, and students tables
      const { error: attendanceError } = await supabase
        .from("attendance")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (attendanceError) throw attendanceError;

      const { error: sessionsError } = await supabase
        .from("sessions")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (sessionsError) throw sessionsError;

      const { error: studentsError } = await supabase
        .from("students")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (studentsError) throw studentsError;

      toast.success("Database reset successfully! All student, session, and attendance data has been cleared.");
    } catch (error) {
      console.error("Error resetting database:", error);
      toast.error("Failed to reset database. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserData.email || !newUserData.password) {
      toast.error("Email and password are required");
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUserData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      toast.success(`User created successfully with ${newUserData.role} role`);
      setCreateUserOpen(false);
      setNewUserData({ email: "", password: "", full_name: "", role: "employee" });
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const adminMenuItems = userRole?.role === "admin" ? [
    {
      title: "Manage Users",
      description: "Create, edit, and delete user accounts",
      icon: UserPlus,
      path: "/manage-users",
      color: "bg-orange-500/10 text-orange-600",
    },
  ] : [];

  const menuItems = [
    {
      title: "Upload Students",
      description: "Import student data from CSV",
      icon: Users,
      path: "/students",
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Generate QR Codes",
      description: "Generate and send QR codes to students",
      icon: QrCode,
      path: "/generate-qr",
      color: "bg-purple-500/10 text-purple-600",
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
    ...adminMenuItems,
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
          <div className="flex gap-2">
            {userRole?.role === "admin" && (
              <>
                <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
                  <DialogTrigger asChild>
                    <Button variant="default">
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New User Account</DialogTitle>
                      <DialogDescription>
                        Create a new user account and assign a role. The user will be able to log in immediately.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={newUserData.email}
                          onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Minimum 6 characters"
                          value={newUserData.password}
                          onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name</Label>
                        <Input
                          id="full_name"
                          type="text"
                          placeholder="John Doe"
                          value={newUserData.full_name}
                          onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role *</Label>
                        <Select
                          value={newUserData.role}
                          onValueChange={(value) => setNewUserData({ ...newUserData, role: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setCreateUserOpen(false)}
                        disabled={creating}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleCreateUser} disabled={creating}>
                        {creating ? "Creating..." : "Create User"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Database className="mr-2 h-4 w-4" />
                      Reset Database
                    </Button>
                  </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all data from:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Students table</li>
                        <li>Sessions table</li>
                        <li>Attendance records</li>
                      </ul>
                      <p className="mt-2 font-semibold">User roles and profiles will NOT be deleted.</p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleResetDatabase}
                      disabled={resetting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {resetting ? "Resetting..." : "Yes, Reset Database"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
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
