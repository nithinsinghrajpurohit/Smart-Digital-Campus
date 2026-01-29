import requests
import sys
import json
from datetime import datetime, timedelta

class CampusAPITester:
    def __init__(self, base_url="https://smart-campus-drwa.onrender.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tokens = {}
        self.users = {}
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "status": "PASSED" if success else "FAILED",
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}, Expected: {expected_status}"
            
            if not success and response.status_code != expected_status:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success and response.content else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration for all roles"""
        print("\n🔍 Testing User Registration...")
        
        # Test student registration
        unique_id = datetime.now().strftime('%H%M%S%f')
        student_data = {
            "email": f"student_{unique_id}@university.edu",
            "password": "TestPass123!",
            "name": "Test Student",
            "role": "student",
            "department": "Computer Science",
            "year": 2,
            "roll_number": f"24AK1A30{unique_id[-2:]}"
        }
        
        success, response = self.run_test(
            "Student Registration",
            "POST",
            "auth/register",
            200,
            student_data
        )
        
        if success:
            self.users['student'] = {**student_data, 'id': response.get('id')}

        # Test faculty registration
        faculty_data = {
            "email": f"faculty_{datetime.now().strftime('%H%M%S')}@university.edu",
            "password": "TestPass123!",
            "name": "Test Faculty",
            "role": "faculty",
            "department": "Computer Science",
            "employee_id": "FAC001"
        }
        
        success, response = self.run_test(
            "Faculty Registration",
            "POST",
            "auth/register",
            200,
            faculty_data
        )
        
        if success:
            self.users['faculty'] = {**faculty_data, 'id': response.get('id')}

        # Test admin registration
        admin_data = {
            "email": f"admin_{datetime.now().strftime('%H%M%S')}@university.edu",
            "password": "TestPass123!",
            "name": "Test Admin",
            "role": "admin",
            "department": "Administration",
            "employee_id": "ADM001"
        }
        
        success, response = self.run_test(
            "Admin Registration",
            "POST",
            "auth/register",
            200,
            admin_data
        )
        
        if success:
            self.users['admin'] = {**admin_data, 'id': response.get('id')}

    def test_user_login(self):
        """Test user login for all roles"""
        print("\n🔍 Testing User Login...")
        
        for role in ['student', 'faculty', 'admin']:
            if role in self.users:
                login_data = {
                    "email": self.users[role]['email'],
                    "password": self.users[role]['password']
                }
                
                success, response = self.run_test(
                    f"{role.title()} Login",
                    "POST",
                    "auth/login",
                    200,
                    login_data
                )
                
                if success and 'token' in response:
                    self.tokens[role] = response['token']

        # Test student login with roll number
        if 'student' in self.users and 'roll_number' in self.users['student']:
            login_data = {
                "email": self.users['student']['roll_number'],
                "password": self.users['student']['password']
            }
            
            success, response = self.run_test(
                "Student Login with Roll Number",
                "POST",
                "auth/login",
                200,
                login_data
            )
            if success:
                self.log_test("Student Login with Roll Number Token Check", 'token' in response)
            else:
                self.log_test("Student Login with Roll Number Token Check", False, "Login failed")

    def test_protected_routes(self):
        """Test protected routes with authentication"""
        print("\n🔍 Testing Protected Routes...")
        
        # Test /auth/me endpoint
        for role in ['student', 'faculty', 'admin']:
            if role in self.tokens:
                headers = {'Authorization': f'Bearer {self.tokens[role]}'}
                self.run_test(
                    f"Get Current User ({role})",
                    "GET",
                    "auth/me",
                    200,
                    headers=headers
                )

    def test_student_endpoints(self):
        """Test student-specific endpoints"""
        print("\n🔍 Testing Student Endpoints...")
        
        if 'faculty' in self.tokens and 'student' in self.users:
            faculty_headers = {'Authorization': f'Bearer {self.tokens["faculty"]}'}
            student_headers = {'Authorization': f'Bearer {self.tokens["student"]}'}
            
            # Test get students (faculty access)
            self.run_test(
                "Get Students List (Faculty)",
                "GET",
                "students",
                200,
                headers=faculty_headers
            )
            
            # Test get student attendance
            student_id = self.users['student']['id']
            self.run_test(
                "Get Student Attendance",
                "GET",
                f"students/{student_id}/attendance",
                200,
                headers=student_headers
            )
            
            # Test get student marks
            self.run_test(
                "Get Student Marks",
                "GET",
                f"students/{student_id}/marks",
                200,
                headers=student_headers
            )

    def test_attendance_management(self):
        """Test attendance marking and retrieval"""
        print("\n🔍 Testing Attendance Management...")
        
        if 'faculty' in self.tokens and 'student' in self.users:
            faculty_headers = {'Authorization': f'Bearer {self.tokens["faculty"]}'}
            
            # Test mark attendance
            attendance_data = {
                "student_id": self.users['student']['id'],
                "student_name": self.users['student']['name'],
                "subject": "Mathematics",
                "date": datetime.now().strftime('%Y-%m-%d'),
                "status": "present"
            }
            
            self.run_test(
                "Mark Attendance",
                "POST",
                "attendance",
                200,
                attendance_data,
                headers=faculty_headers
            )
            
            # Test get all attendance
            self.run_test(
                "Get All Attendance",
                "GET",
                "attendance",
                200,
                headers=faculty_headers
            )

    def test_marks_management(self):
        """Test marks entry and retrieval"""
        print("\n🔍 Testing Marks Management...")
        
        if 'faculty' in self.tokens and 'student' in self.users:
            faculty_headers = {'Authorization': f'Bearer {self.tokens["faculty"]}'}
            
            # Test add marks
            marks_data = {
                "student_id": self.users['student']['id'],
                "student_name": self.users['student']['name'],
                "subject": "Physics",
                "marks": 85.5,
                "max_marks": 100.0,
                "exam_type": "Mid-term"
            }
            
            self.run_test(
                "Add Marks",
                "POST",
                "marks",
                200,
                marks_data,
                headers=faculty_headers
            )
            
            # Test get all marks
            self.run_test(
                "Get All Marks",
                "GET",
                "marks",
                200,
                headers=faculty_headers
            )

    def test_notices_management(self):
        """Test notice posting and retrieval"""
        print("\n🔍 Testing Notices Management...")
        
        if 'faculty' in self.tokens:
            faculty_headers = {'Authorization': f'Bearer {self.tokens["faculty"]}'}
            
            # Test create notice
            notice_data = {
                "title": "Test Notice",
                "content": "This is a test notice for students",
                "role_target": ["student"]
            }
            
            self.run_test(
                "Create Notice",
                "POST",
                "notices",
                200,
                notice_data,
                headers=faculty_headers
            )
            
            # Test get notices
            self.run_test(
                "Get Notices",
                "GET",
                "notices",
                200,
                headers=faculty_headers
            )

    def test_requests_workflow(self):
        """Test request submission and approval workflow"""
        print("\n🔍 Testing Requests Workflow...")
        
        if 'student' in self.tokens and 'faculty' in self.tokens:
            student_headers = {'Authorization': f'Bearer {self.tokens["student"]}'}
            faculty_headers = {'Authorization': f'Bearer {self.tokens["faculty"]}'}
            
            # Test create request
            request_data = {
                "request_type": "leave",
                "reason": "Medical appointment",
                "start_date": datetime.now().strftime('%Y-%m-%d'),
                "end_date": (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
            }
            
            success, response = self.run_test(
                "Create Request",
                "POST",
                "requests",
                200,
                request_data,
                headers=student_headers
            )
            
            request_id = response.get('id') if success else None
            
            # Test get requests
            self.run_test(
                "Get Requests (Student)",
                "GET",
                "requests",
                200,
                headers=student_headers
            )
            
            # Test approve request
            if request_id:
                update_data = {
                    "status": "approved",
                    "admin_comment": "Approved by faculty"
                }
                
                self.run_test(
                    "Update Request Status",
                    "PUT",
                    f"requests/{request_id}",
                    200,
                    update_data,
                    headers=faculty_headers
                )

    def test_admin_analytics(self):
        """Test admin analytics endpoint"""
        print("\n🔍 Testing Admin Analytics...")
        
        if 'admin' in self.tokens:
            admin_headers = {'Authorization': f'Bearer {self.tokens["admin"]}'}
            
            # Test get analytics
            self.run_test(
                "Get Analytics",
                "GET",
                "admin/analytics",
                200,
                headers=admin_headers
            )
            
            # Test get all users
            self.run_test(
                "Get All Users",
                "GET",
                "users",
                200,
                headers=admin_headers
            )

    def test_authorization(self):
        """Test role-based authorization"""
        print("\n🔍 Testing Authorization...")
        
        if 'student' in self.tokens:
            student_headers = {'Authorization': f'Bearer {self.tokens["student"]}'}
            
            # Student should not access admin analytics
            self.run_test(
                "Student Access Admin Analytics (Should Fail)",
                "GET",
                "admin/analytics",
                403,
                headers=student_headers
            )
            
            # Student should not mark attendance
            attendance_data = {
                "student_id": "test",
                "student_name": "test",
                "subject": "test",
                "date": "2024-01-01",
                "status": "present"
            }
            
            self.run_test(
                "Student Mark Attendance (Should Fail)",
                "POST",
                "attendance",
                403,
                attendance_data,
                headers=student_headers
            )

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting Smart Digital Campus API Tests...")
        print(f"Testing against: {self.base_url}")
        
        # Test user management
        self.test_user_registration()
        self.test_user_login()
        self.test_protected_routes()
        
        # Test core functionality
        self.test_student_endpoints()
        self.test_attendance_management()
        self.test_marks_management()
        self.test_notices_management()
        self.test_requests_workflow()
        self.test_admin_analytics()
        
        # Test security
        self.test_authorization()
        
        # Print summary
        print(f"\n📊 Test Summary:")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = CampusAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'tests_run': tester.tests_run,
                'tests_passed': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%"
            },
            'results': tester.test_results,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())

