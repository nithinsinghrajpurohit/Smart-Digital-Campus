import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  GraduationCap, 
  User, 
  Shield, 
  ArrowLeft,
  Mail,
  Lock,
  Hash,
  Briefcase,
  Phone
} from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import API_BASE_URL from "../config";

const API = `${API_BASE_URL}/api`;

const InputWithIcon = ({ icon: Icon, ...props }) => (
  <div className="relative">
    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <Icon className="h-5 w-5 text-gray-400" />
    </div>
    <Input {...props} className="pl-10 h-10" />
  </div>
);

const Login = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState("login");

  const [loginData, setLoginData] = useState({ email: "", password: "", roll_number: "" });
  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    name: "",
    role: "student",
    department: "",
    year: "",
    employee_id: "",
    roll_number: "",
    section: "",
    mobile_number: ""
  });

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setRegisterData(prev => ({ ...prev, role }));
  };

  useEffect(() => {
    if (user) {
      if (user.role === "student") navigate("/student/dashboard", { replace: true });
      else if (user.role === "faculty") navigate("/faculty/dashboard", { replace: true });
      else if (user.role === "admin") navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timerId = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [resendCooldown]);

  const handleSendOTP = async () => {
    if (!registerData.email) {
      toast.error("Please enter your email address first");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${API}/auth/send-otp`, { email: registerData.email });
      toast.success(`OTP sent to ${registerData.email}`);
      setOtpSent(true);
      setResendCooldown(30);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      const { token, user } = response.data;
      login(token, user);
      toast.success("Login successful!");
      
      if (user.role === "student") navigate("/student/dashboard", { replace: true });
      else if (user.role === "faculty") navigate("/faculty/dashboard", { replace: true });
      else if (user.role === "admin") navigate("/admin/dashboard", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...registerData };
      if (payload.role === "student") {
        payload.otp = otp;
        payload.year = parseInt(payload.year);
        delete payload.employee_id;
      } else {
        delete payload.year;
        delete payload.roll_number;
        delete payload.section;
      }
      
      await axios.post(`${API}/auth/register`, payload);
      toast.success("Registration successful! Please login.");
      setRegisterData({
        email: "",
        password: "",
        name: "",
        role: "student",
        department: "",
        year: "",
        employee_id: "",
        roll_number: "",
        section: "",
        mobile_number: ""
      });
      setOtp("");
      setOtpSent(false);
      setActiveTab("login");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white to-gray-100 p-4 text-gray-800">
        <div className="text-center mb-12">
          <GraduationCap className="w-20 h-20 mx-auto text-primary mb-4" strokeWidth={1.5} />
          <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tight">Welcome to Smart Digital Campus</h1>
          <p className="text-lg text-muted-foreground mt-3 max-w-2xl mx-auto">Your integrated platform for academic and administrative excellence. Please select your role to begin.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
          <div className="group relative cursor-pointer" onClick={() => handleRoleSelect('student')}>
            <Card className="text-center p-8 transition-all duration-300 ease-in-out group-hover:bg-primary/5 group-hover:shadow-xl group-hover:-translate-y-2 border-2 border-transparent group-hover:border-primary/50">
              <GraduationCap className="w-16 h-16 mx-auto text-primary mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h2 className="text-2xl font-bold">Student</h2>
              <p className="text-muted-foreground mt-2">Access your courses, grades, and campus updates.</p>
            </Card>
          </div>
          <div className="group relative cursor-pointer" onClick={() => handleRoleSelect('faculty')}>
            <Card className="text-center p-8 transition-all duration-300 ease-in-out group-hover:bg-primary/5 group-hover:shadow-xl group-hover:-translate-y-2 border-2 border-transparent group-hover:border-primary/50">
              <User className="w-16 h-16 mx-auto text-primary mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h2 className="text-2xl font-bold">Faculty</h2>
              <p className="text-muted-foreground mt-2">Manage courses, attendance, marks, and notices.</p>
            </Card>
          </div>
          <div className="group relative cursor-pointer" onClick={() => handleRoleSelect('admin')}>
            <Card className="text-center p-8 transition-all duration-300 ease-in-out group-hover:bg-primary/5 group-hover:shadow-xl group-hover:-translate-y-2 border-2 border-transparent group-hover:border-primary/50">
              <Shield className="w-16 h-16 mx-auto text-primary mb-4 transition-transform duration-300 group-hover:scale-110" />
              <h2 className="text-2xl font-bold">Admin</h2>
              <p className="text-muted-foreground mt-2">Oversee campus operations and user management.</p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2" data-testid="login-page">
      <div className="hidden md:block relative">
        <img
          src="https://i.ytimg.com/vi/S9QR3PjZ_rY/hq720.jpg"
          alt="University Campus"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="text-white text-center p-8 max-w-lg">
            <GraduationCap className="w-20 h-20 mx-auto mb-6" strokeWidth={1.5} />
            <h1 className="font-heading text-4xl font-bold tracking-tight mb-4">Smart Digital Campus</h1>
            <p className="text-lg text-white/90">Centralizing academic excellence and administrative efficiency for a seamless educational experience.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12 bg-gray-50">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            className="mb-6 text-muted-foreground"
            onClick={() => setSelectedRole(null)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to role selection
          </Button>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" data-testid="auth-tabs">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" data-testid="login-form">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Login as {selectedRole}</h3>
                <p className="text-muted-foreground mt-1">Welcome back! Please enter your details.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-4">
                {selectedRole === "student" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="login-email-roll">Email or Roll Number</Label>
                      <InputWithIcon
                        icon={User}
                        id="login-email-roll"
                        data-testid="login-email-roll-input"
                        type="text"
                        placeholder="Enter your email or roll number"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <InputWithIcon
                      icon={Mail}
                      id="login-email"
                      data-testid="login-email-input"
                      type="email"
                      placeholder="your.email@university.edu"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <InputWithIcon
                    icon={Lock}
                    id="login-password" 
                    data-testid="login-password-input"
                    type="password"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  data-testid="login-submit-button"
                  className="w-full rounded-full bg-primary h-11 text-base hover:bg-primary/90 font-semibold tracking-wide transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register" data-testid="register-form">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Create a {selectedRole} account</h3>
                <p className="text-muted-foreground mt-1">Join our digital campus today.</p>
              </div>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Full Name</Label>
                  <InputWithIcon
                    icon={User}
                    id="register-name"
                    data-testid="register-name-input"
                    placeholder="John Doe"
                    value={registerData.name}
                    onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <InputWithIcon
                    icon={Lock}
                    id="register-password"
                    data-testid="register-password-input"
                    type="password"
                    placeholder="Create a strong password"
                    value={registerData.password}
                    onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                    required
                    minLength="8"
                    title="Password must be at least 8 characters long."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-department">Department</Label>
                  <Select
                    value={registerData.department}
                    onValueChange={(value) => setRegisterData({ ...registerData, department: value })}
                  >
                    <SelectTrigger id="register-department" data-testid="register-department-select" className="h-10">
                      <SelectValue placeholder="Select Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Artificial Intelligence and Data Science">Artificial Intelligence and Data Science</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {registerData.role === "student" ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="register-roll-number">Roll Number</Label>
                      <InputWithIcon
                        icon={Hash}
                        id="register-roll-number" 
                        data-testid="register-roll-number-input"
                        placeholder="e.g., 24AK1A3001"
                        value={registerData.roll_number}
                        onChange={(e) => {
                          const roll = e.target.value.toUpperCase();
                          setRegisterData({ 
                            ...registerData, 
                            roll_number: roll
                          });
                        }}
                        required
                        pattern="^[0-9]{2}[a-zA-Z]{2}[0-9]{1}[a-zA-Z]{1}[0-9]{2}[a-zA-Z0-9]{2}$"
                        title="Roll number must be in the format NNLLNLNNAA (e.g., 24AK1A3001)."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-year">Year</Label>
                        <Select value={registerData.year} onValueChange={(value) => setRegisterData({ ...registerData, year: value })}>
                          <SelectTrigger id="register-year" data-testid="register-year-select" className="h-10"><SelectValue placeholder="Year" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1st</SelectItem>
                            <SelectItem value="2">2nd</SelectItem>
                            <SelectItem value="3">3rd</SelectItem>
                            <SelectItem value="4">4th</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-section">Section</Label>
                        <Select value={registerData.section} onValueChange={(value) => setRegisterData({ ...registerData, section: value })}>
                          <SelectTrigger id="register-section" className="h-10"><SelectValue placeholder="Section" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-mobile">Mobile Number</Label>
                      <InputWithIcon
                        icon={Phone}
                        id="register-mobile"
                        data-testid="register-mobile-input"
                        type="tel"
                        placeholder="Enter your 10-digit mobile number"
                        value={registerData.mobile_number}
                        onChange={(e) => setRegisterData({ ...registerData, mobile_number: e.target.value })}
                        pattern="[0-9]{10}"
                        title="Please enter a valid 10-digit mobile number."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <InputWithIcon
                        icon={Mail}
                        id="register-email"
                        type="email"
                        placeholder="your.email@example.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground pt-1">An OTP will be sent to this email for verification.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-otp">OTP Verification</Label>
                      <div className="flex items-center justify-between gap-4">
                        <InputOTP
                          maxLength={6}
                          value={otp}
                          onChange={(value) => setOtp(value)}
                          disabled={!otpSent}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                        <Button type="button" onClick={handleSendOTP} disabled={loading || !registerData.email || resendCooldown > 0} variant="outline" className="h-10">
                          {otpSent
                            ? resendCooldown > 0
                              ? `Resend in ${resendCooldown}s`
                              : "Resend"
                            : "Send OTP"}
                        </Button>
                      </div>
                      {otpSent && <p className="text-xs text-muted-foreground">Check your email for the OTP code.</p>}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="register-employee-id">Employee ID</Label>
                      <InputWithIcon
                        icon={Briefcase}
                        id="register-employee-id"
                        data-testid="register-employee-id-input"
                        placeholder="EMP12345"
                        value={registerData.employee_id}
                        onChange={(e) => setRegisterData({ ...registerData, employee_id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">Email</Label>
                      <InputWithIcon
                        icon={Mail}
                        id="register-email"
                        data-testid="register-email-input"
                        type="email"
                        placeholder="your.email@university.edu"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <Button
                  type="submit"
                  data-testid="register-submit-button"
                  className="w-full rounded-full bg-primary h-11 text-base hover:bg-primary/90 font-semibold tracking-wide transition-all duration-300"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Login;


