import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Attendance = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAttendance();
    }
  }, [user]);

  const fetchAttendance = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select(`
        *,
        students (name, roll, enrollment, section),
        sessions (lab_no, section, date, start_time, end_time)
      `)
      .order("timestamp", { ascending: false });

    if (error) {
      toast.error("Failed to load attendance");
    } else {
      setAttendance(data || []);
    }
    setLoading(false);
  };

  const exportCSV = () => {
    const csvData = attendance.map((record) => ({
      Name: record.students.name,
      Roll: record.students.roll,
      Enrollment: record.students.enrollment,
      Section: record.students.section,
      Lab: record.sessions.lab_no,
      Date: new Date(record.sessions.date).toLocaleDateString(),
      Time: new Date(record.timestamp).toLocaleTimeString(),
      SystemNo: record.system_no,
    }));

    const headers = Object.keys(csvData[0]);
    const csv = [
      headers.join(","),
      ...csvData.map((row) => headers.map((header) => row[header as keyof typeof row]).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("CSV downloaded");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Report", 14, 15);

    const tableData = attendance.map((record) => [
      record.students.name,
      record.students.roll,
      record.students.enrollment,
      record.sessions.lab_no,
      new Date(record.sessions.date).toLocaleDateString(),
      new Date(record.timestamp).toLocaleTimeString(),
    ]);

    autoTable(doc, {
      head: [["Name", "Roll", "Enrollment", "Lab", "Date", "Time"]],
      body: tableData,
      startY: 20,
    });

    doc.save(`attendance_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF downloaded");
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
      <div className="container mx-auto max-w-7xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Attendance Records</CardTitle>
                <CardDescription>View and export attendance data</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportCSV} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button onClick={exportPDF}>
                  <Download className="mr-2 h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Roll</TableHead>
                      <TableHead>Enrollment</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Lab</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>System No</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.students.name}</TableCell>
                        <TableCell>{record.students.roll}</TableCell>
                        <TableCell>{record.students.enrollment}</TableCell>
                        <TableCell>{record.students.section || "N/A"}</TableCell>
                        <TableCell>{record.sessions.lab_no}</TableCell>
                        <TableCell>
                          {new Date(record.sessions.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(record.timestamp).toLocaleTimeString()}
                        </TableCell>
                        <TableCell>{record.system_no}</TableCell>
                      </TableRow>
                    ))}
                    {attendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No attendance records yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Attendance;
