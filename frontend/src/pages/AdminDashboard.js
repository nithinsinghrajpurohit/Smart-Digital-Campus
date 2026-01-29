import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../App";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LogOut, Users, FileText, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import API_BASE_URL from "../config";

const API = `${API_BASE_URL}/api`;

const AdminDashboard = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notices, setNotices] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);

  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    role_target: ["student", "faculty"]
  });

  const loadData = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [analyticsRes, usersRes, requestsRes, noticesRes, complaintsRes] = await Promise.all([
        axios.get(`${API}/admin/analytics`, { headers }),
        axios.get(`${API}/users`, { headers }),
        axios.get(`${API}/requests`, { headers }),
        axios.get(`${API}/notices`, { headers }),
        axios.get(`${API}/complaints`, { headers })
      ]);
      
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
      setRequests(requestsRes.data);
      setNotices(noticesRes.data);
      setComplaints(complaintsRes.data);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateNotice = async (e) => {
    e.preventDefault();
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/notices`, newNotice, { headers });
      toast.success("System-wide notice posted");
      setNoticeDialogOpen(false);
      setNewNotice({ title: "", content: "", role_target: ["student", "faculty"] });
      loadData();
    } catch (error) {
      toast.error("Failed to post notice");
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

  if (loading || !analytics) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const chartData = [
    { name: "Students", value: analytics.total_students },
    { name: "Faculty", value: analytics.total_faculty },
    { name: "Pending Requests", value: analytics.pending_requests },
    { name: "Total Notices", value: analytics.total_notices }
  ];

  const sectionPerformanceData = analytics.section_marks.map(item => ({
    name: `Y${item.year}-S${item.section}`,
    'Average Percentage': item.average_percentage,
  }));

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-dashboard">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-primary">Smart Digital Campus</h1>
            <p className="text-sm text-muted-foreground">Admin Control Panel - {user.name}</p>
          </div>
          <TooltipProvider>
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
          </TooltipProvider>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow" data-testid="students-stat-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{analytics.total_students}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="faculty-stat-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Faculty
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{analytics.total_faculty}</div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow" data-testid="requests-stat-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-heading font-bold text-primary">{analytics.pending_requests}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2" data-testid="analytics-chart-card">
            <CardHeader>
              <CardTitle className="font-heading">System Overview</CardTitle>
              <CardDescription>Key metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px'
                    }}
                  />
                  <Bar dataKey="value" fill="#0f393b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Dialog open={noticeDialogOpen} onOpenChange={setNoticeDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full h-16 text-lg" data-testid="post-system-notice-button">
                  <Bell className="w-5 h-5 mr-2" />
                  Post System-Wide Notice
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="notice-dialog">
                <DialogHeader>
                  <DialogTitle className="text-2xl">Post System Notice</DialogTitle>
                  <DialogDescription>This will be visible to all users</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateNotice} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      data-testid="notice-title-input"
                      value={newNotice.title}
                      onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                      placeholder="Important Announcement"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      data-testid="notice-content-input"
                      value={newNotice.content}
                      onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                      placeholder="Notice details..."
                      rows={5}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full rounded-full" data-testid="submit-notice-button">
                    Post Notice
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Card data-testid="quick-stats-card">
              <CardHeader>
                <CardTitle className="font-heading text-base">Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Users</span>
                  <span className="font-mono font-semibold">{users.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Active Notices</span>
                  <span className="font-mono font-semibold">{notices.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Requests</span>
                  <span className="font-mono font-semibold">{requests.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mb-6" data-testid="section-performance-card">
          <CardHeader>
            <CardTitle className="font-heading">Section Performance</CardTitle>
            <CardDescription>Average marks percentage by section</CardDescription>
          </CardHeader>
          <CardContent>
            {sectionPerformanceData && sectionPerformanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectionPerformanceData}>
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px' }} />
                  <YAxis unit="%" domain={[0, 100]} stroke="#64748b" style={{ fontSize: '12px' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Legend />
                  <Bar dataKey="Average Percentage" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48"><p className="text-muted-foreground">No marks data available to show section performance.</p></div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6" data-testid="all-requests-card">
          <CardHeader>
            <CardTitle className="font-heading">All Student Requests</CardTitle>
            <CardDescription>Review and manage all requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No requests found</p>
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
                        <Button
                          size="sm"
                          onClick={() => handleUpdateRequest(request.id, "approved", "Approved by admin")}
                          className="rounded-full"
                          data-testid="approve-request-button"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleUpdateRequest(request.id, "rejected", "Rejected by admin")}
                          className="rounded-full"
                          data-testid="reject-request-button"
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {request.approved_by_name && <p>Updated by: {request.approved_by_name}</p>}
                        {request.admin_comment && <p className="italic">Comment: {request.admin_comment}</p>}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6" data-testid="complaints-card">
          <CardHeader>
            <CardTitle className="font-heading">Complaint Box</CardTitle>
            <CardDescription>Anonymously submitted complaints from students and faculty.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {complaints.length === 0 ? (
                <p className="text-sm text-muted-foreground">No complaints found</p>
              ) : (
                complaints.map((complaint) => (
                  <div key={complaint.id} className="p-4 border border-border/40 rounded-sm">
                    <p className="text-sm mb-2">{complaint.content}</p>
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

        <Card data-testid="users-management-card">
          <CardHeader>
            <CardTitle className="font-heading">User Management</CardTitle>
            <CardDescription>All registered users in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <table className="w-full text-sm" data-testid="users-table">
                <thead className="sticky top-0 bg-gray-100">
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Identifier</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Mobile Number</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">No users found</td>
                    </tr>
                  ) : (
                    users.map((userItem) => (
                      <tr key={userItem.id} className="hover:bg-gray-50" data-testid="user-row">
                        <td className="p-3 font-medium">{userItem.name}</td>
                        <td className="p-3">{userItem.roll_number || userItem.employee_id || "-"}</td>
                        <td className="p-3">{userItem.email}</td>
                        <td className="p-3">{userItem.mobile_number || "-"}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono text-xs uppercase">
                            {userItem.role}
                          </Badge>
                        </td>
                        <td className="p-3">{userItem.department || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
