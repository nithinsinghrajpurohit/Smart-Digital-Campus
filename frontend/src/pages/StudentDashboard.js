import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../App";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Calendar, FileText, ClipboardList, Bell, User, MessageSquareWarning, Pencil } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import API_BASE_URL from "../config";

const API = `${API_BASE_URL}/api`;

const StudentDashboard = () => {
  const { user, token, login } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [marks, setMarks] = useState([]);
  const [notices, setNotices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ content: "" });
  const [profileImageDialogOpen, setProfileImageDialogOpen] = useState(false);
  const [newProfileImageUrl, setNewProfileImageUrl] = useState("");
  const [newRequest, setNewRequest] = useState({
    request_type: "leave",
    reason: "",
    start_date: "",
    end_date: "",
    roll_number: user.roll_number || ""
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({
    roll_number: "",
    year: "",
    section: "",
    mobile_number: ""
  });

  const loadData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [attendanceRes, marksRes, noticesRes, requestsRes] = await Promise.all([
        axios.get(`${API}/students/${user.id}/attendance`, { headers }),
        axios.get(`${API}/students/${user.id}/marks`, { headers }),
        axios.get(`${API}/notices`, { headers }),
        axios.get(`${API}/requests`, { headers })
      ]);
      
      setAttendance(attendanceRes.data);
      setMarks(marksRes.data);
      setNotices(noticesRes.data);
      setRequests(requestsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token, user.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Poll every 30 seconds for new notices
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (user) {
      setEditFormData({
        roll_number: user.roll_number || "",
        year: user.year ? String(user.year) : "",
        section: user.section || "",
        mobile_number: user.mobile_number || ""
      });
    }
  }, [user]);

  useEffect(() => {
    if (notices.length > 0) {
      const latestNotice = notices[0];
      const storageKey = `lastSeenNoticeId_${user.id}`;
      const lastSeenId = localStorage.getItem(storageKey);

      if (latestNotice.id !== lastSeenId) {
        setNoticesOpen(true);
        localStorage.setItem(storageKey, latestNotice.id);

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`New Notice: ${latestNotice.title}`, {
            body: latestNotice.content,
          });
        }
        toast.info("You have a new notice!");
      }
    }
  }, [notices, user.id]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/requests`, newRequest, { headers });
      toast.success("Request submitted successfully");
      setRequestDialogOpen(false);
      setNewRequest({ request_type: "leave", reason: "", start_date: "", end_date: "", roll_number: user.roll_number || "" });
      loadData();
    } catch (error) {
      toast.error("Failed to submit request");
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

  const handleProfileImageUpdate = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.put(`${API}/users/me/profile-image`, { profile_image_url: newProfileImageUrl }, { headers });
      
      // The backend returns the updated user. We need to update the auth context.
      login(token, response.data);

      toast.success("Profile photo updated successfully.");
      setProfileImageDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update profile photo.");
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const payload = {
        ...editFormData,
        year: editFormData.year ? parseInt(editFormData.year) : null
      };
      
      const response = await axios.put(`${API}/users/me`, payload, { headers });
      
      login(token, response.data);
      toast.success("Profile details updated successfully.");
      setIsEditingProfile(false);
    } catch (error) {
      toast.error("Failed to update profile details.");
    }
  };

  const attendanceRate = attendance.length > 0
    ? ((attendance.filter(a => a.status === "present").length / attendance.length) * 100).toFixed(1)
    : 0;

  const averageMarks = marks.length > 0
    ? (marks.reduce((acc, m) => acc + (m.marks / m.max_marks) * 100, 0) / marks.length).toFixed(1)
    : 0;

  const attendanceBySubject = attendance.reduce((acc, record) => {
    if (!acc[record.subject]) {
      acc[record.subject] = { total: 0, present: 0 };
    }
    acc[record.subject].total++;
    if (record.status === 'present') {
      acc[record.subject].present++;
    }
    return acc;
  }, {});

  const attendanceChartData = Object.keys(attendanceBySubject).map(subject => ({
    name: subject,
    Attendance: parseFloat(((attendanceBySubject[subject].present / attendanceBySubject[subject].total) * 100).toFixed(1)),
  }));

  const marksChartData = marks.map(record => ({
    name: `${record.subject} (${record.exam_type})`,
    Percentage: parseFloat(((record.marks / record.max_marks) * 100).toFixed(1)),
  }));

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="student-dashboard">
      {/* Dialog for creating a new request */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent data-testid="request-dialog">
          <DialogHeader>
            <DialogTitle>Submit Request</DialogTitle>
            <DialogDescription>Fill in the details for your request</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                value={newRequest.request_type}
                onValueChange={(value) => setNewRequest({ ...newRequest, request_type: value })}
              >
                <SelectTrigger data-testid="request-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="od">On Duty</SelectItem>
                  <SelectItem value="grievance">Grievance</SelectItem>
                  <SelectItem value="certificate">Certificate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roll Number</Label>
              <Input
                data-testid="request-roll-number-input"
                value={newRequest.roll_number}
                onChange={(e) => setNewRequest({ ...newRequest, roll_number: e.target.value })}
                placeholder="Enter Roll Number"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                data-testid="request-reason-input"
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                placeholder="Enter reason for your request"
                required
              />
            </div>
            {(newRequest.request_type === "leave" || newRequest.request_type === "od") && (
              <>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    data-testid="request-start-date-input"
                    type="date"
                    value={newRequest.start_date}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    data-testid="request-end-date-input"
                    type="date"
                    value={newRequest.end_date}
                    min={newRequest.start_date || new Date().toISOString().split('T')[0]}
                    onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })}
                    required
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full rounded-full" data-testid="submit-request-form-button">
              Permission request
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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

      {/* Dialog for updating profile image */}
      <Dialog open={profileImageDialogOpen} onOpenChange={setProfileImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Profile Photo</DialogTitle>
            <DialogDescription>
              Paste a URL to an image to set it as your profile photo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProfileImageUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-image-url">Image URL</Label>
              <Input
                id="profile-image-url"
                value={newProfileImageUrl}
                onChange={(e) => setNewProfileImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <Button type="submit" className="w-full">Update Photo</Button>
          </form>
        </DialogContent>
      </Dialog>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-primary">Smart Digital Campus</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Dialog open={noticesOpen} onOpenChange={setNoticesOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="relative rounded-full" size="icon">
                        <Bell className="h-5 w-5" />
                        <span className="sr-only">View Notices</span>
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Notices</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Recent Notices</DialogTitle>
                    <DialogDescription>Latest announcements from faculty and admin</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
                    {notices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No notices available</p>
                    ) : (
                      notices.map((notice) => (
                        <div key={notice.id} className="notice-item p-4 border border-border/40 rounded-sm" data-testid="notice-item">
                          <h4 className="font-semibold text-sm mb-1">{notice.title}</h4>
                          <p className="text-sm text-muted-foreground mb-2">{notice.content}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>By: {notice.posted_by_name}</span>
                            <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="rounded-full" size="icon">
                        <ClipboardList className="h-5 w-5" />
                        <span className="sr-only">View My Requests</span>
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>My Requests</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>My Requests</DialogTitle>
                    <DialogDescription>Track your submitted requests and create new ones.</DialogDescription>
                  </DialogHeader>
                  <Button className="w-full mb-4" data-testid="submit-request-button" onClick={() => setRequestDialogOpen(true)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Submit New Request
                  </Button>
                  <div className="space-y-3 max-h-[50vh] overflow-y-auto p-1">
                    {requests.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No requests submitted</p>
                    ) : (
                      requests.map((request) => (
                        <div key={request.id} className="p-4 border border-border/40 rounded-sm" data-testid="request-item">
                          <div className="flex items-start justify-between mb-2">
                            <Badge
                              variant={request.status === "pending" ? "secondary" : request.status === "approved" ? "default" : "destructive"}
                              className="font-mono text-xs uppercase"
                              data-testid="request-status-badge"
                            >
                              {request.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground uppercase tracking-wider">{request.request_type}</span>
                          </div>
                          <p className="text-sm mb-2">{request.reason}</p>
                          {request.admin_comment && (
                            <p className="text-xs text-muted-foreground italic">Comment: {request.admin_comment}</p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                            <span>{new Date(request.created_at).toLocaleDateString()}</span>
                            {request.status !== 'pending' && request.approved_by_name && (
                              <span>Updated by: {request.approved_by_name}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="rounded-full" size="icon" data-testid="profile-button">
                        <User className="h-5 w-5" />
                        <span className="sr-only">View Profile</span>
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Profile</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent className="max-w-md" data-testid="profile-dialog">
                  <DialogHeader>
                    <DialogTitle className="flex justify-between items-center">
                      Student Profile
                      {!isEditingProfile && (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </Button>
                      )}
                    </DialogTitle>
                    <DialogDescription>Your academic details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {user.profile_image_url ? (
                            <img src={user.profile_image_url} alt={user.name} className="h-16 w-16 rounded-full object-cover" />
                        ) : (
                          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                          </div>
                        )}
                        <Button size="icon" variant="outline" className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full" onClick={() => {
                            setNewProfileImageUrl(user.profile_image_url || "");
                            setProfileImageDialogOpen(true);
                        }}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      <div>
                        <h3 className="font-heading text-lg font-semibold">{user.name}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    {isEditingProfile ? (
                      <form onSubmit={handleProfileUpdate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-roll">Roll Number</Label>
                            <Input 
                              id="edit-roll" 
                              value={editFormData.roll_number} 
                              onChange={(e) => setEditFormData({...editFormData, roll_number: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-mobile">Mobile</Label>
                            <Input 
                              id="edit-mobile" 
                              value={editFormData.mobile_number} 
                              onChange={(e) => setEditFormData({...editFormData, mobile_number: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-year">Year</Label>
                            <Select 
                              value={editFormData.year} 
                              onValueChange={(value) => setEditFormData({...editFormData, year: value})}
                            >
                              <SelectTrigger id="edit-year"><SelectValue placeholder="Year" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1st</SelectItem>
                                <SelectItem value="2">2nd</SelectItem>
                                <SelectItem value="3">3rd</SelectItem>
                                <SelectItem value="4">4th</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-section">Section</Label>
                            <Select 
                              value={editFormData.section} 
                              onValueChange={(value) => setEditFormData({...editFormData, section: value})}
                            >
                              <SelectTrigger id="edit-section"><SelectValue placeholder="Section" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsEditingProfile(false)}>Cancel</Button>
                          <Button type="submit">Save Changes</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Roll Number</p>
                          <p className="font-medium">{user.roll_number || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Department</p>
                          <p className="font-medium">{user.department || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Year</p>
                          <p className="font-medium">{user.year ? `${user.year} Year` : "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Section</p>
                          <p className="font-medium">{user.section || "-"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Mobile Number</p>
                          <p className="font-medium">{user.mobile_number || "-"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

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
            </div>
          </TooltipProvider>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow" data-testid="attendance-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attendance Rate</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{attendanceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">{attendance.length} classes recorded</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="marks-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Marks</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{averageMarks}%</div>
              <p className="text-xs text-muted-foreground mt-1">{marks.length} exams</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="requests-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">
                {requests.filter(r => r.status === "pending").length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{requests.length} total requests</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="notices-count-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Notices</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{notices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active announcements</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card data-testid="attendance-chart-card">
            <CardHeader>
              <CardTitle className="font-heading">Attendance by Subject</CardTitle>
              <CardDescription>Your attendance percentage for each subject.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={attendanceChartData} margin={{ top: 5, right: 20, left: -10, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    style={{ fontSize: '12px' }} 
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} unit="%" domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend wrapperStyle={{ bottom: 0 }} />
                  <Line type="monotone" dataKey="Attendance" stroke="#0f393b" strokeWidth={2} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="marks-chart-card">
            <CardHeader>
              <CardTitle className="font-heading">Marks Overview</CardTitle>
              <CardDescription>Your performance in recent exams.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={marksChartData} margin={{ top: 5, right: 20, left: -10, bottom: 50 }}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    style={{ fontSize: '12px' }} 
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} unit="%" domain={[0, 100]} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Bar dataKey="Percentage" fill="#0f393b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card data-testid="attendance-list-card">
            <CardHeader>
              <CardTitle className="font-heading">Attendance Records</CardTitle>
              <CardDescription>Your attendance history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40">
                    <tr>
                      <th className="text-left py-2 font-medium">Subject</th>
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">No attendance records</td>
                      </tr>
                    ) : (
                      attendance.slice(0, 20).map((record) => (
                        <tr key={record.id} className="table-row border-b border-border/20" data-testid="attendance-row">
                          <td className="py-3">{record.subject}</td>
                          <td className="py-3">{record.date}</td>
                          <td className="py-3">
                            <Badge variant={record.status === "present" ? "default" : "secondary"} className="font-mono text-xs">
                              {record.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="marks-list-card">
            <CardHeader>
              <CardTitle className="font-heading">Marks Records</CardTitle>
              <CardDescription>Your exam results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/40">
                    <tr>
                      <th className="text-left py-2 font-medium">Subject</th>
                      <th className="text-left py-2 font-medium">Exam</th>
                      <th className="text-left py-2 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marks.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">No marks records</td>
                      </tr>
                    ) : (
                      marks.slice(0, 20).map((record) => (
                        <tr key={record.id} className="table-row border-b border-border/20" data-testid="marks-row">
                          <td className="py-3">{record.subject}</td>
                          <td className="py-3">{record.exam_type}</td>
                          <td className="py-3">
                            <span className="font-mono font-semibold">
                              {record.marks}/{record.max_marks}
                            </span>
                            <span className="text-muted-foreground ml-2">({((record.marks / record.max_marks) * 100).toFixed(0)}%)</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;


