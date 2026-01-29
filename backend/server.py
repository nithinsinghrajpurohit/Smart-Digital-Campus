from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import random
import string 
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
VALID_FACULTY_IDS = ["66", "107", "102", "132", "222", "319"]

security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: Literal["student", "faculty", "admin"]
    background_image_url: Optional[str] = None
    profile_image_url: Optional[str] = None
    department: Optional[str] = None
    year: Optional[int] = None  # for students
    section: Optional[str] = None  # for students
    roll_number: Optional[str] = None  # for students
    employee_id: Optional[str] = None  # for faculty

    mobile_number: Optional[str] = None

class UserCreate(UserBase):
    password: str
    otp: Optional[str] = None

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user: User

class StudentAttendanceStatus(BaseModel):
    student_id: str
    student_name: str
    status: Literal["present", "absent"]

class BatchAttendanceCreate(BaseModel):
    students_status: List[StudentAttendanceStatus]
    subject: str
    date: str

class StudentMarksEntry(BaseModel):
    student_id: str
    student_name: str
    marks: float

class BatchMarksCreate(BaseModel):
    students_marks: List[StudentMarksEntry]
    subject: str
    max_marks: float
    exam_type: str

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    subject: str
    date: str
    status: Literal["present", "absent"]

    marked_by: str
    marked_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AttendanceCreate(BaseModel):
    student_id: str
    student_name: str
    subject: str
    date: str
    status: Literal["present", "absent"]

class MarksRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    subject: str
    marks: float
    max_marks: float
    exam_type: str
    marked_by: str
    marked_by_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MarksCreate(BaseModel):
    student_id: str
    student_name: str
    subject: str
    marks: float
    max_marks: float
    exam_type: str

class Notice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    content: str
    posted_by: str
    posted_by_name: str
    role_target: List[str]  # ["student", "faculty", "admin"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class NoticeCreate(BaseModel):
    title: str
    content: str
    role_target: List[str]

class Request(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    roll_number: Optional[str] = None
    request_type: Literal["od", "leave", "grievance", "certificate"]
    reason: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    status: Literal["pending", "approved", "rejected"] = "pending"
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    admin_comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RequestCreate(BaseModel):
    request_type: Literal["od", "leave", "grievance", "certificate"]
    reason: str
    roll_number: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class RequestUpdate(BaseModel):
    status: Literal["approved", "rejected"]
    admin_comment: Optional[str] = None

class ProfileImageUpdate(BaseModel):
    profile_image_url: str

class OTPRequest(BaseModel):
    email: EmailStr

class ComplaintCreate(BaseModel):
    content: str

class Complaint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    content: str
    submitted_by_role: str
    year: Optional[int] = None
    section: Optional[str] = None
    department: Optional[str] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SectionMarks(BaseModel):
    year: int
    section: str
    average_percentage: float

class AnalyticsSummary(BaseModel):
    total_students: int
    total_faculty: int
    pending_requests: int
    total_notices: int
    section_marks: List[SectionMarks]

# Helper functions
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if user_doc is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc.get('created_at'), str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def send_email_task(to_email: str, subject: str, body: str):
    """Background task to send email via SMTP"""
    print("🚀 Starting email sending task...")
    smtp_email = os.environ.get('SMTP_EMAIL')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    smtp_port = int(os.environ.get('SMTP_PORT', 465))

    if not smtp_email or not smtp_password:
        print(f"⚠️ SMTP credentials missing. Email to {to_email} skipped.")
        return

    try:
        print(f"Attempting to connect to {smtp_server} on port {smtp_port}...")
        msg = MIMEMultipart()
        msg['From'] = formataddr(('Smart Digital Campus', smtp_email))
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=15) as server:
            print("...Connection successful. Attempting to log in...")
            server.login(smtp_email, smtp_password)
            print("...Login successful. Sending message...")
            server.send_message(msg)
            print(f"📧 Email sent to {to_email}")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
    print("✅ Email sending task finished.")

# Explicitly handle OPTIONS for send-otp to resolve 400 Bad Request issues
@api_router.options("/auth/send-otp")
async def options_send_otp():
    return {"message": "OK"}

# OTP endpoints
@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest, background_tasks: BackgroundTasks):
    # if not request.email.endswith("@aits-tpt.edu.in"):
    #     raise HTTPException(status_code=400, detail="Email must be an @aits-tpt.edu.in address")
        
    otp = ''.join(random.choices(string.digits, k=6))
    
    # Store OTP with expiration (e.g., 10 minutes)
    await db.otps.update_one(
        {"email": request.email},
        {"$set": {"otp": otp, "created_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    
    # In a real application, send this via email. For now, we log it.
    print(f"🔐 OTP for {request.email}: {otp}")
    
    email_subject = "Smart Digital Campus - Verification OTP"
    email_body = f"Your verification code is: {otp}\n\nThis code expires in 10 minutes."
    background_tasks.add_task(send_email_task, request.email, email_subject, email_body)
    
    return {"message": "OTP sent successfully"}

# Auth endpoints
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    if len(user_data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")

    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if user_data.role == "admin" and user_data.employee_id != "9":
        raise HTTPException(status_code=400, detail="Invalid employee ID")
    
    if user_data.role == "faculty" and user_data.employee_id not in VALID_FACULTY_IDS:
        raise HTTPException(status_code=400, detail="Invalid employee ID")

    if user_data.role == "student":
        # if not user_data.email.endswith("@aits-tpt.edu.in"):
        #     raise HTTPException(status_code=400, detail="Student email must be @aits-tpt.edu.in")
        
        if not user_data.otp:
            raise HTTPException(status_code=400, detail="OTP is required for student registration")
            
        otp_record = await db.otps.find_one({"email": user_data.email})
        if not otp_record or otp_record.get("otp") != user_data.otp:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
        await db.otps.delete_one({"email": user_data.email})

    user_dict = user_data.model_dump()
    password = user_dict.pop("password")
    user_dict.pop("otp", None) # Remove OTP from user data before saving
    password_hash = hash_password(password)
    
    user = User(**user_dict)
    doc = user.model_dump()
    doc['password_hash'] = password_hash
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.users.insert_one(doc)
    return user

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(login_data: LoginRequest):
    # Try to find user by email first
    user_doc = await db.users.find_one({"email": login_data.email}, {"_id": 0})
    
    # If not found by email, try by roll number
    if not user_doc:
        user_doc = await db.users.find_one({"roll_number": login_data.email}, {"_id": 0})

    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, user_doc.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user_doc.pop('password_hash', None)
    user = User(**user_doc)
    
    token = create_access_token({"sub": user.id, "role": user.role})
    return LoginResponse(token=token, user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@api_router.put("/users/me/profile-image", response_model=User)
async def update_profile_image(
    update_data: ProfileImageUpdate,
    current_user: User = Depends(get_current_user)
):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"profile_image_url": update_data.profile_image_url}}
    )
    
    updated_user_doc = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not updated_user_doc:
        raise HTTPException(status_code=404, detail="User not found after update")

    if isinstance(updated_user_doc.get('created_at'), str):
        updated_user_doc['created_at'] = datetime.fromisoformat(updated_user_doc['created_at'])
    
    return User(**updated_user_doc)

# Student endpoints
@api_router.get("/students", response_model=List[User])
async def get_students(
    year: Optional[int] = None, 
    section: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"role": "student"}
    if year:
        query["year"] = year
    if section:
        query["section"] = section

    students = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("roll_number", 1).to_list(1000)
    for student in students:
        if isinstance(student.get('created_at'), str):
            student['created_at'] = datetime.fromisoformat(student['created_at'])
    return students

@api_router.get("/students/{student_id}/attendance", response_model=List[AttendanceRecord])
async def get_student_attendance(student_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await db.attendance.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    for record in records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return records

@api_router.get("/students/{student_id}/marks", response_model=List[MarksRecord])
async def get_student_marks(student_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    records = await db.marks.find({"student_id": student_id}, {"_id": 0}).to_list(1000)
    for record in records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return records

# Attendance endpoints
@api_router.post("/attendance/batch", status_code=status.HTTP_201_CREATED)
async def mark_batch_attendance(attendance_data: BatchAttendanceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can mark attendance")
    
    records_to_insert = []
    for student_status in attendance_data.students_status:
        record = AttendanceRecord(
            student_id=student_status.student_id,
            student_name=student_status.student_name,
            subject=attendance_data.subject,
            date=attendance_data.date,
            status=student_status.status,
            marked_by=current_user.id,
            marked_by_name=current_user.name
        )
        doc = record.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        records_to_insert.append(doc)
        
    if not records_to_insert:
        raise HTTPException(status_code=400, detail="No attendance records provided")
        
    await db.attendance.insert_many(records_to_insert)
    return {"message": f"Attendance marked for {len(records_to_insert)} students."}

@api_router.post("/marks/batch", status_code=status.HTTP_201_CREATED)
async def add_batch_marks(marks_data: BatchMarksCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can add marks")
    
    records_to_insert = []
    for student_mark in marks_data.students_marks:
        record = MarksRecord(
            student_id=student_mark.student_id,
            student_name=student_mark.student_name,
            subject=marks_data.subject,
            marks=student_mark.marks,
            max_marks=marks_data.max_marks,
            exam_type=marks_data.exam_type,
            marked_by=current_user.id,
            marked_by_name=current_user.name
        )
        doc = record.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        records_to_insert.append(doc)
        
    if not records_to_insert:
        raise HTTPException(status_code=400, detail="No marks records provided")
        
    await db.marks.insert_many(records_to_insert)
    return {"message": f"Marks added for {len(records_to_insert)} students."}

@api_router.post("/attendance", response_model=AttendanceRecord)
async def mark_attendance(attendance_data: AttendanceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can mark attendance")
    
    record = AttendanceRecord(
        **attendance_data.model_dump(),
        marked_by=current_user.id,
        marked_by_name=current_user.name
    )
    
    doc = record.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.attendance.insert_one(doc)
    return record

@api_router.get("/attendance", response_model=List[AttendanceRecord])
async def get_all_attendance(
    date: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    section: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    match_query = {}
    if date:
        match_query["date"] = date
    if subject:
        match_query["subject"] = subject

    if not year and not section:
        records = await db.attendance.find(match_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        for record in records:
            if isinstance(record.get('created_at'), str):
                record['created_at'] = datetime.fromisoformat(record['created_at'])
        return records

    # Aggregation pipeline for filtering by year/section
    pipeline = []
    if match_query:
        pipeline.append({"$match": match_query})
    
    pipeline.extend([
        {
            "$lookup": {
                "from": "users",
                "localField": "student_id",
                "foreignField": "id",
                "as": "student_info"
            }
        },
        {"$unwind": "$student_info"}
    ])

    user_match_query = {}
    if year:
        user_match_query["student_info.year"] = year
    if section:
        user_match_query["student_info.section"] = section
    
    if user_match_query:
        pipeline.append({"$match": user_match_query})

    pipeline.append({"$project": {field: 1 for field in AttendanceRecord.model_fields if field != 'model_config'}})
    pipeline.append({"$project": {"_id": 0}})

    records = await db.attendance.aggregate(pipeline).to_list(length=1000)
    for record in records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return records

@api_router.post("/marks", response_model=MarksRecord)
async def add_marks(marks_data: MarksCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "faculty":
        raise HTTPException(status_code=403, detail="Only faculty can add marks")
    
    record = MarksRecord(
        **marks_data.model_dump(),
        marked_by=current_user.id,
        marked_by_name=current_user.name
    )
    
    doc = record.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.marks.insert_one(doc)
    return record

@api_router.get("/marks", response_model=List[MarksRecord])
async def get_all_marks(
    subject: Optional[str] = None,
    exam_type: Optional[str] = None,
    year: Optional[int] = None,
    section: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    match_query = {}
    if subject:
        match_query["subject"] = subject
    if exam_type:
        match_query["exam_type"] = exam_type

    if not year and not section:
        records = await db.marks.find(match_query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        for record in records:
            if isinstance(record.get('created_at'), str):
                record['created_at'] = datetime.fromisoformat(record['created_at'])
        return records

    # Aggregation pipeline for filtering by year/section
    pipeline = []
    if match_query:
        pipeline.append({"$match": match_query})
    
    pipeline.extend([
        {
            "$lookup": {
                "from": "users",
                "localField": "student_id",
                "foreignField": "id",
                "as": "student_info"
            }
        },
        {"$unwind": "$student_info"}
    ])

    user_match_query = {}
    if year:
        user_match_query["student_info.year"] = year
    if section:
        user_match_query["student_info.section"] = section
    
    if user_match_query:
        pipeline.append({"$match": user_match_query})

    pipeline.append({"$project": {field: 1 for field in MarksRecord.model_fields if field != 'model_config'}})
    pipeline.append({"$project": {"_id": 0}})

    records = await db.marks.aggregate(pipeline).to_list(length=1000)
    for record in records:
        if isinstance(record.get('created_at'), str):
            record['created_at'] = datetime.fromisoformat(record['created_at'])
    return records

# Notices endpoints
@api_router.post("/notices", response_model=Notice)
async def create_notice(notice_data: NoticeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Only faculty and admin can post notices")
    
    notice = Notice(
        **notice_data.model_dump(),
        posted_by=current_user.id,
        posted_by_name=current_user.name
    )
    
    doc = notice.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.notices.insert_one(doc)
    return notice

@api_router.get("/notices", response_model=List[Notice])
async def get_notices(current_user: User = Depends(get_current_user)):
    notices = await db.notices.find(
        {"role_target": {"$in": [current_user.role]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    for notice in notices:
        if isinstance(notice.get('created_at'), str):
            notice['created_at'] = datetime.fromisoformat(notice['created_at'])
    return notices

# Requests endpoints
@api_router.post("/requests", response_model=Request)
async def create_request(request_data: RequestCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can create requests")
    
    req_dict = request_data.model_dump()
    if not req_dict.get('roll_number') and current_user.roll_number:
        req_dict['roll_number'] = current_user.roll_number

    request = Request(
        **req_dict,
        student_id=current_user.id,
        student_name=current_user.name
    )
    
    doc = request.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.requests.insert_one(doc)
    return request

@api_router.get("/requests", response_model=List[Request])
async def get_requests(current_user: User = Depends(get_current_user)):
    if current_user.role == "student":
        query = {"student_id": current_user.id}
    else:
        query = {}
    
    requests = await db.requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
    return requests

@api_router.put("/requests/{request_id}", response_model=Request)
async def update_request(request_id: str, update_data: RequestUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Only faculty and admin can update requests")
    
    update_dict = update_data.model_dump()
    update_dict['approved_by'] = current_user.id
    update_dict['approved_by_name'] = current_user.name
    
    result = await db.requests.update_one(
        {"id": request_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request_doc = await db.requests.find_one({"id": request_id}, {"_id": 0})
    if isinstance(request_doc.get('created_at'), str):
        request_doc['created_at'] = datetime.fromisoformat(request_doc['created_at'])
    
    return Request(**request_doc)

# Complaint Endpoints
@api_router.post("/complaints", response_model=Complaint)
async def submit_complaint(complaint_data: ComplaintCreate, current_user: User = Depends(get_current_user)):
    complaint = Complaint(
        content=complaint_data.content,
        submitted_by_role=current_user.role,
        year=current_user.year,
        section=current_user.section,
        department=current_user.department
    )
    
    doc = complaint.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.complaints.insert_one(doc)
    return complaint

@api_router.get("/complaints", response_model=List[Complaint])
async def get_complaints(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["faculty", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to view complaints")
    
    complaints = await db.complaints.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for complaint in complaints:
        if isinstance(complaint.get('created_at'), str):
            complaint['created_at'] = datetime.fromisoformat(complaint['created_at'])
    return complaints

# Admin analytics
@api_router.get("/admin/analytics", response_model=AnalyticsSummary)
async def get_analytics(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access analytics")
    
    total_students = await db.users.count_documents({"role": "student"})
    total_faculty = await db.users.count_documents({"role": "faculty"})
    pending_requests = await db.requests.count_documents({"status": "pending"})
    total_notices = await db.notices.count_documents({})
    
    # Calculate average marks per section
    marks_pipeline = [
        {
            '$lookup': {
                'from': 'users',
                'localField': 'student_id',
                'foreignField': 'id',
                'as': 'student_info'
            }
        },
        {'$unwind': '$student_info'},
        {
            '$match': {
                'student_info.role': 'student',
                'student_info.section': {'$ne': None},
                'student_info.year': {'$ne': None}
            }
        },
        {
            '$project': {
                'section': '$student_info.section',
                'year': '$student_info.year',
                'percentage': {
                    '$cond': [
                        {'$eq': ['$max_marks', 0]}, 
                        0, 
                        {'$multiply': [{'$divide': ['$marks', '$max_marks']}, 100]}
                    ]
                }
            }
        },
        {
            '$group': {
                '_id': {'year': '$year', 'section': '$section'},
                'average_percentage': {'$avg': '$percentage'}
            }
        },
        {'$sort': {'_id.year': 1, '_id.section': 1}},
        {
            '$project': {
                '_id': 0,
                'year': '$_id.year',
                'section': '$_id.section',
                'average_percentage': {'$round': ['$average_percentage', 2]}
            }
        }
    ]
    section_marks_cursor = db.marks.aggregate(marks_pipeline)
    section_marks = await section_marks_cursor.to_list(length=None)

    return AnalyticsSummary(
        total_students=total_students,
        total_faculty=total_faculty,
        pending_requests=pending_requests,
        total_notices=total_notices,
        section_marks=section_marks
    )

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can access all users")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for user in users:
        if isinstance(user.get('created_at'), str):
            user['created_at'] = datetime.fromisoformat(user['created_at'])
    return users

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
