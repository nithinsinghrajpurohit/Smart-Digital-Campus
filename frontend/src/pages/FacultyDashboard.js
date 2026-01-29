import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../App";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner"; 
import { LogOut, UserCheck, GraduationCap, FileText, Bell, Check, X, User, MessageSquareWarning } from "lucide-react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../config";

const API = `${API_BASE_URL}/api`;

const FacultyDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState([]);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [marksDialogOpen, setMarksDialogOpen] = useState(false);

  // New states for batch attendance
  const [attendanceYear, setAttendanceYear] = useState("");
  const [attendanceSection, setAttendanceSection] = useState("");
  const [attendanceSubject, setAttendanceSubject] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceStudents, setAttendanceStudents] = useState([]);
  const [attendanceStatuses, setAttendanceStatuses] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);

  // New states for batch marks
  const [marksYear, setMarksYear] = useState("");
  const [marksSection, setMarksSection] = useState("");
  const [marksSubject, setMarksSubject] = useState("");
  const [marksExamType, setMarksExamType] = useState("");
  const [marksMaxMarks, setMarksMaxMarks] = useState("100");
  const [marksStudents, setMarksStudents] = useState([]);
  const [marksData, setMarksData] = useState({});
  const [loadingMarksStudents, setLoadingMarksStudents] = useState(false);

  // New states for attendance overview
  const [subjects, setSubjects] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [overviewYear, setOverviewYear] = useState("");
  const [overviewSection, setOverviewSection] = useState("");
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // New states for marks overview
  const [marksOverviewSubject, setMarksOverviewSubject] = useState("");
  const [marksOverviewExamType, setMarksOverviewExamType] = useState("");
  const [marksOverviewYear, setMarksOverviewYear] = useState("");
  const [marksOverviewSection, setMarksOverviewSection] = useState("");
  const [filteredMarksOverview, setFilteredMarksOverview] = useState([]);
  const [loadingMarksOverview, setLoadingMarksOverview] = useState(false);
  const [marksSubjects, setMarksSubjects] = useState([]);
  const [examTypes, setExamTypes] = useState([]);

  // New states for student list filter
  const [studentListYear, setStudentListYear] = useState("");
  const [studentListSection, setStudentListSection] = useState("");
  const [searchRollNumber, setSearchRollNumber] = useState("");

  // New states for student profile view
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentProfileData, setStudentProfileData] = useState({ attendance: [], marks: [], loading: false });
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // New state for complaint box
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ content: "" });


  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    role_target: ["student"]
  });

  const loadData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [studentsRes, requestsRes, noticesRes, allAttendanceRes, complaintsRes, allMarksRes] = await Promise.all([
        axios.get(`${API}/students`, { headers }),
        axios.get(`${API}/requests`, { headers }),
        axios.get(`${API}/notices`, { headers }),
        axios.get(`${API}/attendance`, { headers }), // Fetch all attendance to get subjects
        axios.get(`${API}/complaints`, { headers }),
        axios.get(`${API}/marks`, { headers }),
      ]);
      
      setStudents(studentsRes.data);
      setRequests(requestsRes.data);
      setNotices(noticesRes.data);
      setComplaints(complaintsRes.data);

      // For attendance overview
      const uniqueSubjects = [...new Set(allAttendanceRes.data.map(item => item.subject).filter(Boolean))];
      setSubjects(uniqueSubjects);
      setSelectedSubject(prev => prev || (uniqueSubjects.length > 0 ? uniqueSubjects[0] : ""));

      // For marks overview
      const uniqueMarksSubjects = [...new Set(allMarksRes.data.map(item => item.subject).filter(Boolean))];
      const uniqueExamTypes = [...new Set(allMarksRes.data.map(item => item.exam_type).filter(Boolean))];
      setMarksSubjects(uniqueMarksSubjects);
      setExamTypes(uniqueExamTypes);
      setMarksOverviewSubject(prev => prev || (uniqueMarksSubjects.length > 0 ? uniqueMarksSubjects[0] : ""));
      setMarksOverviewExamType(prev => prev || (uniqueExamTypes.length > 0 ? uniqueExamTypes[0] : ""));

    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch filtered attendance when date or subject changes
  useEffect(() => {
    const fetchFilteredAttendance = async () => {
      if (!selectedSubject || !selectedDate || !token) return;
      setLoadingAttendance(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const params = new URLSearchParams({
          date: selectedDate,
          subject: selectedSubject,
        });
        if (overviewYear && overviewYear !== 'all') params.append('year', overviewYear);
        if (overviewSection && overviewSection !== 'all') params.append('section', overviewSection);

        const response = await axios.get(`${API}/attendance?${params.toString()}`, { headers });
        setFilteredAttendance(response.data);
      } catch (error) {
        toast.error("Failed to fetch attendance data for the selected criteria.");
        setFilteredAttendance([]);
      } finally {
        setLoadingAttendance(false);
      }
    };

    fetchFilteredAttendance();
  }, [selectedDate, selectedSubject, overviewYear, overviewSection, token]);

  // Fetch filtered marks when filters change
  useEffect(() => {
    const fetchFilteredMarks = async () => {
      if (!token) return;
      setLoadingMarksOverview(true);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const params = new URLSearchParams();
        if (marksOverviewSubject) params.append('subject', marksOverviewSubject);
        if (marksOverviewExamType) params.append('exam_type', marksOverviewExamType);
        if (marksOverviewYear && marksOverviewYear !== 'all') params.append('year', marksOverviewYear);
        if (marksOverviewSection && marksOverviewSection !== 'all') params.append('section', marksOverviewSection);

        const response = await axios.get(`${API}/marks?${params.toString()}`, { headers });
        setFilteredMarksOverview(response.data);
      } catch (error) {
        toast.error("Failed to fetch marks data.");
        setFilteredMarksOverview([]);
      } finally {
        setLoadingMarksOverview(false);
      }
    };

    fetchFilteredMarks();
  }, [marksOverviewSubject, marksOverviewExamType, marksOverviewYear, marksOverviewSection, token]);

  const handleViewStudentProfile = async (student) => {
    setSelectedStudent(student);
    setIsProfileDialogOpen(true);
    setStudentProfileData({ attendance: [], marks: [], loading: true });
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [attendanceRes, marksRes] = await Promise.all([
        axios.get(`${API}/students/${student.id}/attendance`, { headers }),
        axios.get(`${API}/students/${student.id}/marks`, { headers })
      ]);
      setStudentProfileData({
        attendance: attendanceRes.data,
        marks: marksRes.data,
        loading: false
      });
    } catch (error) {
      toast.error("Failed to load student's detailed profile.");
      setStudentProfileData({ attendance: [], marks: [], loading: false });
    }
  };

  const handleCreateComplaint = async (e) => {
    e.preventDefault();
    if (!newComplaint.content.trim()) {
        toast.error("Complaint content cannot be empty.");
        return;
    }
    try {
        const headers = { Authorization: `Bearer ${token}` };
        await axios.post(`${API}/complaints`, newComplaint, { headers });
        toast.success("Complaint submitted anonymously.");
        setComplaintDialogOpen(false);
        setNewComplaint({ content: "" });
    } catch (error) {
        toast.error("Failed to submit complaint.");
    }
  };

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/notices`, newNotice, { headers });
      toast.success("Notice posted successfully");
      setNoticeDialogOpen(false);
      setNewNotice({ title: "", content: "", role_target: ["student"] });
      loadData();
    } catch (error) {
      toast.error("Failed to post notice");
    }
  };

  const fetchAttendanceStudents = async () => {
    if (!attendanceYear || !attendanceSection) {
      toast.error("Please select both year and section.");
      return;
    }
    setLoadingStudents(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/students?year=${attendanceYear}&section=${attendanceSection}`, { headers });
      const sortedStudents = response.data.sort((a, b) => (a.roll_number || "").localeCompare(b.roll_number || ""));
      setAttendanceStudents(sortedStudents);
      // Default all to present
      const statuses = sortedStudents.reduce((acc, student) => {
        acc[student.id] = 'present';
        return acc;
      }, {});
      setAttendanceStatuses(statuses);
    } catch (error) {
      toast.error("Failed to fetch students.");
      setAttendanceStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleAttendanceStatusChange = (studentId, status) => {
    setAttendanceStatuses(prev => ({ ...prev, [studentId]: status }));
  };

  const handleBatchAttendanceSubmit = async (e) => {
    e.preventDefault();
    if (attendanceStudents.length === 0) {
      toast.error("No students to mark attendance for.");
      return;
    }
    if (!attendanceSubject) {
      toast.error("Please enter a subject.");
      return;
    }

    const students_status = Object.keys(attendanceStatuses).map(studentId => {
      const student = attendanceStudents.find(s => s.id === studentId);
      return {
        student_id: studentId,
        student_name: student.name,
        status: attendanceStatuses[studentId]
      };
    });

    const payload = {
      students_status,
      subject: attendanceSubject,
      date: attendanceDate
    };

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/attendance/batch`, payload, { headers });
      toast.success(`Attendance submitted for ${students_status.length} students.`);
      setAttendanceDialogOpen(false);
      // Reset state
      setAttendanceYear("");
      setAttendanceSection("");
      setAttendanceSubject("");
      setAttendanceStudents([]);
      setAttendanceStatuses({});
    } catch (error) {
      toast.error("Failed to submit attendance.");
    }
  };

  const fetchMarksStudents = async () => {
    if (!marksYear || !marksSection) {
      toast.error("Please select both year and section.");
      return;
    }
    setLoadingMarksStudents(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.get(`${API}/students?year=${marksYear}&section=${marksSection}`, { headers });
      const sortedStudents = response.data.sort((a, b) => (a.roll_number || "").localeCompare(b.roll_number || ""));
      setMarksStudents(sortedStudents);
      const initialMarks = {};
      sortedStudents.forEach(student => {
        initialMarks[student.id] = "";
      });
      setMarksData(initialMarks);
    } catch (error) {
      toast.error("Failed to fetch students.");
      setMarksStudents([]);
    } finally {
      setLoadingMarksStudents(false);
    }
  };

  const handleMarksChange = (studentId, value) => {
    setMarksData(prev => ({ ...prev, [studentId]: value }));
  };

  const handleBatchMarksSubmit = async (e) => {
    e.preventDefault();
    if (marksStudents.length === 0) {
      toast.error("No students to add marks for.");
      return;
    }
    if (!marksSubject || !marksExamType || !marksMaxMarks) {
      toast.error("Please fill in all exam details.");
      return;
    }

    const students_marks = marksStudents
      .filter(student => marksData[student.id] !== "" && marksData[student.id] !== undefined)
      .map(student => ({
        student_id: student.id,
        student_name: student.name,
        marks: parseFloat(marksData[student.id])
      }));

    if (students_marks.length === 0) {
      toast.error("Please enter marks for at least one student.");
      return;
    }

    const payload = {
      students_marks,
      subject: marksSubject,
      max_marks: parseFloat(marksMaxMarks),
      exam_type: marksExamType
    };

    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/marks/batch`, payload, { headers });
      toast.success(`Marks added for ${students_marks.length} students.`);
      setMarksDialogOpen(false);
      setMarksYear("");
      setMarksSection("");
      setMarksSubject("");
      setMarksExamType("");
      setMarksMaxMarks("100");
      setMarksStudents([]);
      setMarksData({});
    } catch (error) {
      toast.error("Failed to submit marks.");
    }
  };

  const handleUpdateRequest = async (requestId, status, comment = "") => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/requests/${requestId}`, { status, admin_comment: comment }, { headers });
      toast.success(`Request ${status}`);
      loadData();
    } catch (error) {
      toast.error("Failed to update request");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const presentStudentsList = useMemo(() => filteredAttendance.filter(r => r.status === 'present'), [filteredAttendance]);
  const absentStudentsList = useMemo(() => filteredAttendance.filter(r => r.status === 'absent'), [filteredAttendance]);

  const renderStudentAttendanceRows = (records) => {
    if (records.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan="2" className="text-center h-24">
            No students in this list.
          </TableCell>
        </TableRow>

      );
    }
    return records.map((record) => {
      const student = students.find(s => s.id === record.student_id);
      return (
        <TableRow key={record.id}>
          <TableCell>{record.student_name}</TableCell>
          <TableCell>{student?.roll_number || 'N/A'}</TableCell>
        </TableRow>
      );
    });
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const filteredStudents = useMemo(() => {
    const filtered = students.filter(student => {
      const yearMatch = !studentListYear || studentListYear === 'all' ? true : String(student.year) === studentListYear;
      const sectionMatch = !studentListSection || studentListSection === 'all' ? true : student.section === studentListSection;
      const rollNumberMatch = !searchRollNumber || student.roll_number?.toLowerCase().includes(searchRollNumber.toLowerCase());
      return yearMatch && sectionMatch && rollNumberMatch;
    });
    // Sort by roll number
    return filtered.sort((a, b) => (a.roll_number || "").localeCompare(b.roll_number || ""));
  }, [students, studentListYear, studentListSection, searchRollNumber]);


  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="faculty-dashboard">
      {/* Complaint Box Dialog */}
      <Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Submit a Complaint</DialogTitle>
                <DialogDescription>
                    Your complaint will be submitted anonymously. Your name and email will not be recorded. Please be respectful and constructive.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateComplaint} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="complaint-content">Complaint Details</Label>
                    <Textarea
                        id="complaint-content"
                        value={newComplaint.content}
                        onChange={(e) => setNewComplaint({ ...newComplaint, content: e.target.value })}
                        placeholder="Describe your issue or suggestion here..."
                        rows={6}
                        required
                    />
                </div>
                <Button type="submit" className="w-full">Submit Anonymously</Button>
            </form>
        </DialogContent>
      </Dialog>

      {/* Student Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="student-profile-dialog">
          <DialogHeader>
            <DialogTitle>Student Profile</DialogTitle>
            <DialogDescription>
              Viewing details for {selectedStudent?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-semibold">{selectedStudent.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStudent.email}</p>
                </div>
              </div>
              {/* Profile Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4">
                <div>
                  <p className="text-muted-foreground">Roll Number</p>
                  <p className="font-medium">{selectedStudent.roll_number || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedStudent.department || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Year</p>
                  <p className="font-medium">{selectedStudent.year ? `${selectedStudent.year} Year` : "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Section</p>
                  <p className="font-medium">{selectedStudent.section || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mobile Number</p>
                  <p className="font-medium">{selectedStudent.mobile_number || "-"}</p>
                </div>
              </div>

              {/* Attendance and Marks */}
              {studentProfileData.loading ? (
                <div className="text-center p-8">Loading academic records...</div>
              ) : (
                <Tabs defaultValue="attendance" className="w-full">
                  <TabsList>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="marks">Marks</TabsTrigger>
                  </TabsList>
                  <TabsContent value="attendance">
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentProfileData.attendance.length > 0 ? (
                            studentProfileData.attendance.map(record => (
                              <TableRow key={record.id}>
                                <TableCell>{record.subject}</TableCell>
                                <TableCell>{record.date}</TableCell>
                                <TableCell>
                                  <Badge variant={record.status === 'present' ? 'default' : 'destructive'}>{record.status}</Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan="3" className="text-center h-24">No attendance records found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                  <TabsContent value="marks">
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Subject</TableHead>
                            <TableHead>Exam</TableHead>
                            <TableHead>Score</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studentProfileData.marks.length > 0 ? (
                            studentProfileData.marks.map(record => (
                              <TableRow key={record.id}>
                                <TableCell>{record.subject}</TableCell>
                                <TableCell>{record.exam_type}</TableCell>
                                <TableCell>{record.marks} / {record.max_marks}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan="3" className="text-center h-24">No marks records found.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-primary">Smart Digital Campus</h1>
            <p className="text-sm text-muted-foreground">Faculty Portal - {user.name}</p>
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" className="rounded-full" size="icon" onClick={() => setComplaintDialogOpen(true)}>
                      <MessageSquareWarning className="h-5 w-5" />
                      <span className="sr-only">Submit Complaint</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Submit Complaint</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    className="rounded-full"
                    data-testid="logout-button"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Logout</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow" data-testid="students-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{students.length}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="pending-requests-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">
                {requests.filter(r => r.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="notices-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posted Notices</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{notices.length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 text-lg" data-testid="mark-attendance-button">
                <UserCheck className="w-5 h-5 mr-2" />
                Mark Attendance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl" data-testid="attendance-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl">Mark Batch Attendance</DialogTitle>
                <DialogDescription>Select year and section to fetch students and mark attendance.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBatchAttendanceSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={attendanceYear} onValueChange={setAttendanceYear}>
                      <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select value={attendanceSection} onValueChange={setAttendanceSection}>
                      <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Button type="button" onClick={fetchAttendanceStudents} disabled={loadingStudents || !attendanceYear || !attendanceSection} className="w-full">
                      {loadingStudents ? "Fetching..." : "Fetch Students"}
                    </Button>
                  </div>
                </div>

                {attendanceStudents.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input value={attendanceSubject} onChange={(e) => setAttendanceSubject(e.target.value)} placeholder="e.g., Mathematics" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} required />
                      </div>
                    </div>

                    <div className="border rounded-md max-h-64 overflow-y-auto">
                      <Table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="text-left p-2 font-medium">Roll No.</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-center p-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceStudents.map(student => (
                            <tr key={student.id} className="border-b">
                              <td className="p-2">{student.roll_number}</td>
                              <td className="p-2">{student.name}</td>
                              <td className="p-2 text-center">
                                <div className="flex justify-center gap-2">
                                  <Button type="button" size="icon" variant={attendanceStatuses[student.id] === 'present' ? 'default' : 'ghost'} onClick={() => handleAttendanceStatusChange(student.id, 'present')} className="h-8 w-8"> <Check className="h-4 w-4" /> </Button>
                                  <Button type="button" size="icon" variant={attendanceStatuses[student.id] === 'absent' ? 'destructive' : 'ghost'} onClick={() => handleAttendanceStatusChange(student.id, 'absent')} className="h-8 w-8"> <X className="h-4 w-4" /> </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <Button type="submit" className="w-full rounded-full"> Submit Attendance for {attendanceStudents.length} Students </Button>
                  </>
                )}
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={marksDialogOpen} onOpenChange={setMarksDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 text-lg" data-testid="add-marks-button">
                <GraduationCap className="w-5 h-5 mr-2" />
                Add Marks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl" data-testid="marks-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl">Add Batch Marks</DialogTitle>
                <DialogDescription>Select year and section to fetch students and add marks.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBatchMarksSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={marksYear} onValueChange={setMarksYear}>
                      <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select value={marksSection} onValueChange={setMarksSection}>
                      <SelectTrigger><SelectValue placeholder="Select Section" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Button type="button" onClick={fetchMarksStudents} disabled={loadingMarksStudents || !marksYear || !marksSection} className="w-full">
                      {loadingMarksStudents ? "Fetching..." : "Fetch Students"}
                    </Button>
                  </div>
                </div>

                {marksStudents.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Subject</Label>
                        <Input value={marksSubject} onChange={(e) => setMarksSubject(e.target.value)} placeholder="e.g., Physics" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Exam Type</Label>
                        <Input value={marksExamType} onChange={(e) => setMarksExamType(e.target.value)} placeholder="e.g., Mid-term" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Marks</Label>
                        <Input type="number" value={marksMaxMarks} onChange={(e) => setMarksMaxMarks(e.target.value)} required />
                      </div>
                    </div>

                    <div className="border rounded-md max-h-64 overflow-y-auto">
                      <Table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="text-left p-2 font-medium">Roll No.</th>
                            <th className="text-left p-2 font-medium">Name</th>
                            <th className="text-center p-2 font-medium">Marks Obtained</th>
                          </tr>
                        </thead>
                        <tbody>
                          {marksStudents.map(student => (
                            <tr key={student.id} className="border-b">
                              <td className="p-2">{student.roll_number}</td>
                              <td className="p-2">{student.name}</td>
                              <td className="p-2 text-center">
                                <Input 
                                  type="number" 
                                  step="0.01"
                                  className="w-24 mx-auto h-8"
                                  value={marksData[student.id] || ""} 
                                  onChange={(e) => handleMarksChange(student.id, e.target.value)}
                                  placeholder="0"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                    <Button type="submit" className="w-full rounded-full"> Submit Marks for {marksStudents.length} Students </Button>
                  </>
                )}
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 text-lg" data-testid="post-notice-button">
                <Bell className="w-5 h-5 mr-2" />
                Post Notice
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="notice-dialog">
              <DialogHeader>
                <DialogTitle className="text-2xl">Post a New Notice</DialogTitle>
                <DialogDescription>Create an announcement</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateNotice} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    data-testid="notice-title-input"
                    value={newNotice.title}
                    onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                    placeholder="Notice title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    data-testid="notice-content-input"
                    value={newNotice.content}
                    onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                    placeholder="Notice details"
                    rows={4}
                    required
                  />
                </div>
                <Button type="submit" className="w-full rounded-full" data-testid="submit-notice-button">
                  Post Notice
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="attendance" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12">
            <TabsTrigger value="attendance">Attendance Overview</TabsTrigger>
            <TabsTrigger value="marks">Marks Overview</TabsTrigger>
            <TabsTrigger value="requests">Student Requests</TabsTrigger>
            <TabsTrigger value="students">Students List</TabsTrigger>
            <TabsTrigger value="complaints">Complaint Box</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
                <CardDescription>View daily attendance records for your subjects.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="attendance-date">Date</Label>
                    <Input type="date" id="attendance-date" value={selectedDate} onChange={handleDateChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject-select">Subject</Label>
                    <Select onValueChange={setSelectedSubject} value={selectedSubject}>
                      <SelectTrigger className="w-full md:w-[200px]" id="subject-select">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.length > 0 ? (
                          subjects.map(subject => (
                            <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-subjects" disabled>No subjects found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overview-year">Year</Label>
                    <Select value={overviewYear} onValueChange={setOverviewYear}>
                      <SelectTrigger id="overview-year" className="w-full md:w-[180px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overview-section">Section</Label>
                    <Select value={overviewSection} onValueChange={setOverviewSection}>
                      <SelectTrigger id="overview-section" className="w-full md:w-[180px]"><SelectValue placeholder="All Sections" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loadingAttendance ? <p className="text-center py-8">Loading attendance...</p> : (
                  <div className="grid gap-6 md:grid-cols-2 mt-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Present Students ({presentStudentsList.length})</h3>
                      <Card>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Roll Number</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>{renderStudentAttendanceRows(presentStudentsList)}</TableBody>
                        </Table>
                      </Card>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Absent Students ({absentStudentsList.length})</h3>
                      <Card>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Roll Number</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>{renderStudentAttendanceRows(absentStudentsList)}</TableBody>
                        </Table>
                      </Card>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="marks">
            <Card>
              <CardHeader>
                <CardTitle>Marks Overview</CardTitle>
                <CardDescription>View student performance by subject and exam type.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="marks-subject-select">Subject</Label>
                    <Select onValueChange={setMarksOverviewSubject} value={marksOverviewSubject}>
                      <SelectTrigger className="w-full md:w-[200px]" id="marks-subject-select">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {marksSubjects.length > 0 ? (
                          marksSubjects.map(subject => (
                            <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-subjects" disabled>No subjects found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exam-type-select">Exam Type</Label>
                    <Select onValueChange={setMarksOverviewExamType} value={marksOverviewExamType}>
                      <SelectTrigger className="w-full md:w-[200px]" id="exam-type-select">
                        <SelectValue placeholder="Select exam type" />
                      </SelectTrigger>
                      <SelectContent>
                        {examTypes.length > 0 ? (
                          examTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-exams" disabled>No exams found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marks-overview-year">Year</Label>
                    <Select value={marksOverviewYear} onValueChange={setMarksOverviewYear}>
                      <SelectTrigger id="marks-overview-year" className="w-full md:w-[150px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="marks-overview-section">Section</Label>
                    <Select value={marksOverviewSection} onValueChange={setMarksOverviewSection}>
                      <SelectTrigger id="marks-overview-section" className="w-full md:w-[150px]"><SelectValue placeholder="All Sections" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {loadingMarksOverview ? <p className="text-center py-8">Loading marks...</p> : (
                  <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-gray-100">
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Roll Number</TableHead>
                          <TableHead>Marks Obtained</TableHead>
                          <TableHead>Max Marks</TableHead>
                          <TableHead>Percentage</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMarksOverview.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              No marks records found for the selected criteria.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredMarksOverview.map((record) => {
                            const student = students.find(s => s.id === record.student_id);
                            const percentage = ((record.marks / record.max_marks) * 100).toFixed(2);
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.student_name}</TableCell>
                                <TableCell>{student?.roll_number || 'N/A'}</TableCell>
                                <TableCell>{record.marks}</TableCell>
                                <TableCell>{record.max_marks}</TableCell>
                                <TableCell>
                                  <Badge variant={percentage >= 40 ? "outline" : "destructive"}>
                                    {percentage}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="requests">
            <Card data-testid="requests-approval-card">
              <CardHeader>
                <CardTitle className="font-heading">Student Requests</CardTitle>
                <CardDescription>Review and approve student requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {requests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requests to review</p>
                  ) : (
                    requests.map((request) => (
                      <div key={request.id} className="p-4 border border-border/40 rounded-sm" data-testid="request-item">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{request.student_name}</h4>
                            <Badge
                              variant={request.status === "pending" ? "secondary" : request.status === "approved" ? "default" : "destructive"}
                              className="font-mono text-xs uppercase mt-1"
                              data-testid="request-status-badge"
                            >
                              {request.status}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">{request.request_type}</span>
                        </div>
                        <p className="text-sm mb-2">{request.reason}</p>
                        {(request.start_date || request.end_date) && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Duration: {request.start_date} to {request.end_date}
                          </p>
                        )}
                        {request.status === 'pending' ? (
                          <div className="flex gap-2 mt-3">
                            <Button size="sm" onClick={() => handleUpdateRequest(request.id, "approved", "Approved by faculty")} className="rounded-full" data-testid="approve-request-button"> Approve </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleUpdateRequest(request.id, "rejected", "Rejected by faculty")} className="rounded-full" data-testid="reject-request-button"> Reject </Button>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {request.approved_by_name && <p>Updated by: {request.approved_by_name}</p>}
                            {request.admin_comment && <p className="italic">Comment: {request.admin_comment}</p>}
                          </div>
                        )
                        }
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="students">
            <Card data-testid="students-list-card">
              <CardHeader>
                <CardTitle className="font-heading">Students List</CardTitle>
                <CardDescription>Filter and view registered students by year and section.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="student-search-roll">Search by Roll Number</Label>
                    <Input 
                      id="student-search-roll"
                      placeholder="Enter all or part of a roll number..."
                      value={searchRollNumber}
                      onChange={(e) => setSearchRollNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={studentListYear} onValueChange={setStudentListYear}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Year" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Select value={studentListSection} onValueChange={setStudentListSection}>
                      <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Filter by Section" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sections</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="ghost" onClick={() => { setStudentListYear(""); setStudentListSection(""); setSearchRollNumber(""); }}>Clear Filters</Button>
                </div>
                <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-gray-100">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Roll Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Mobile Number</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Year & Section</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center">
                            {studentListYear || studentListSection ? "No students match the selected criteria." : "No students found."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((student) => (
                          <TableRow key={student.id} data-testid="student-row" className="hover:bg-gray-50">
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.roll_number || "-"}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>{student.mobile_number || "-"}</TableCell>
                            <TableCell>{student.department}</TableCell>
                            <TableCell>{student.year ? `${student.year} - ${student.section || 'N/A'}`: "-"}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => handleViewStudentProfile(student)}>View Profile</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="complaints">
            <Card>
                <CardHeader>
                    <CardTitle>Complaint Box</CardTitle>
                    <CardDescription>Anonymously submitted complaints from students and faculty.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                        {complaints.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No complaints found.</p>
                        ) : (
                            complaints.map((complaint) => (
                                <div key={complaint.id} className="p-4 border rounded-lg bg-muted/20">
                                    <p className="text-sm mb-3">{complaint.content}</p>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                            From: {complaint.submitted_by_role === 'student'
                                                ? `Student (Year: ${complaint.year || 'N/A'}, Section: ${complaint.section || 'N/A'})`
                                                : `Faculty (${complaint.department || 'N/A'})`
                                            }
                                        </span>
                                        <span>{new Date(complaint.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default FacultyDashboard;
