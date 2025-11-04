import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { ArrowLeft, Upload, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { z } from "zod";

const studentSchema = z.object({
  roll: z.string().min(1, "Roll number required"),
  name: z.string().min(1, "Name required"),
  enrollment: z.string().min(1, "Enrollment required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  sem: z.string().optional(),
  college: z.string().optional(),
  section: z.string().optional(),
  system_no: z.string().optional(),
});

const Students = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const data = results.data as any[];
          
          if (data.length === 0) {
            toast.error("CSV file is empty");
            setUploading(false);
            return;
          }

          const validatedData = [];
          const errors = [];

          for (let i = 0; i < data.length; i++) {
            try {
              const validated = studentSchema.parse(data[i]);
              validatedData.push(validated);
            } catch (error: any) {
              errors.push(`Row ${i + 2}: ${error.errors[0].message}`);
            }
          }

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 5).join("\n")}`);
            setUploading(false);
            return;
          }

          setPreview(validatedData.slice(0, 5));

          const studentsToInsert = validatedData.map((student) => ({
            ...student,
            uploaded_by: user?.id,
          }));

          const { error } = await supabase
            .from("students")
            .insert(studentsToInsert);

          if (error) {
            if (error.code === "23505") {
              toast.error("Some enrollment numbers already exist");
            } else {
              throw error;
            }
          } else {
            toast.success(`Successfully uploaded ${validatedData.length} students`);
          }
          
          setUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        },
        error: (error) => {
          toast.error(`CSV parsing error: ${error.message}`);
          setUploading(false);
        },
      });
    } catch (error: any) {
      toast.error(error.message);
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `roll,name,enrollment,email,phone,sem,college,section,system_no
101,John Doe,EN2023001,john.doe@college.edu,9876543210,5,ABC Engineering College,A,PC-01
102,Jane Smith,EN2023002,jane.smith@college.edu,9876543211,5,ABC Engineering College,A,PC-02
103,Mike Johnson,EN2023003,mike.j@college.edu,9876543212,5,ABC Engineering College,B,PC-03
104,Sarah Williams,EN2023004,sarah.w@college.edu,9876543213,6,ABC Engineering College,B,PC-04
105,David Brown,EN2023005,david.b@college.edu,9876543214,6,ABC Engineering College,A,PC-05`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student_template.csv";
    a.click();
    toast.success("Template downloaded with example data");
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
      <div className="container mx-auto max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Upload Students</CardTitle>
            <CardDescription>
              Import student data from CSV file. All fields are text-based.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="flex-1"
              />
              <Button disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>

            {preview.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Enrollment</TableHead>
                        <TableHead>Section</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((student, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{student.roll}</TableCell>
                          <TableCell>{student.name}</TableCell>
                          <TableCell>{student.enrollment}</TableCell>
                          <TableCell>{student.section || "N/A"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Students;
