from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch
from io import BytesIO
import base64
import shutil

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'lacucina-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Upload directory
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Kitchen Inventory API", version="2.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

# Company/Tenant
class CompanyCreate(BaseModel):
    name: str
    logo_url: Optional[str] = ""

class CompanyResponse(BaseModel):
    id: str
    name: str
    logo_url: str
    created_at: str

# User
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_id: str
    role: str = "user"  # admin, user

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    company_id: str
    company_name: Optional[str] = ""
    role: str
    created_at: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    company_id: Optional[str] = None

# Unit
class UnitCreate(BaseModel):
    name: str
    initials: str  # For order ID format
    address: Optional[str] = ""

class UnitResponse(BaseModel):
    id: str
    company_id: str
    name: str
    initials: str
    address: str
    created_at: str

# Section
class SectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Package"

class SectionResponse(BaseModel):
    id: str
    company_id: str
    name: str
    description: str
    icon: str
    created_at: str

# Item - Updated with minimum stock per day and visibility settings
class MinimumStockByDay(BaseModel):
    monday: float = 0
    tuesday: float = 0
    wednesday: float = 0
    thursday: float = 0
    friday: float = 0
    saturday: float = 0
    sunday: float = 0

class ItemCreate(BaseModel):
    name: str
    section_id: str
    unit_of_measure: str  # kg, un, cx, l, bottle, bucket, can, bag, pack, etc.
    minimum_stock: float = 0  # Base minimum stock (kept for backward compatibility)
    minimum_stock_by_day: Optional[MinimumStockByDay] = None  # Individual day minimums
    average_consumption: float = 0
    item_type: str = "all"  # all, restaurant, factory
    visible_in_units: List[str] = []  # Empty list = visible in all units
    show_in_reports: bool = True

class ItemResponse(BaseModel):
    id: str
    company_id: str
    name: str
    section_id: str
    section_name: Optional[str] = ""
    unit_of_measure: str
    minimum_stock: float
    minimum_stock_by_day: Optional[dict] = None
    average_consumption: float
    item_type: str = "all"
    visible_in_units: List[str] = []
    show_in_reports: bool = True
    created_at: str

# Available units of measure
UNITS_OF_MEASURE = [
    {"value": "kg", "label": "Kilogram (kg)"},
    {"value": "g", "label": "Gram (g)"},
    {"value": "l", "label": "Liter (l)"},
    {"value": "ml", "label": "Milliliter (ml)"},
    {"value": "un", "label": "Unit (un)"},
    {"value": "cx", "label": "Box (cx)"},
    {"value": "pack", "label": "Pack"},
    {"value": "bag", "label": "Bag"},
    {"value": "can", "label": "Can"},
    {"value": "bottle", "label": "Bottle"},
    {"value": "bucket", "label": "Bucket"},
    {"value": "jar", "label": "Jar"},
    {"value": "tray", "label": "Tray"},
    {"value": "dozen", "label": "Dozen"},
    {"value": "bunch", "label": "Bunch"},
    {"value": "slice", "label": "Slice"},
    {"value": "portion", "label": "Portion"},
]

# Safety Stock - Now with quantity increment per day
class SafetyStockCreate(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    quantity_increment: float = 0  # Additional quantity to add to minimum stock
    enabled: bool = True

class SafetyStockResponse(BaseModel):
    id: str
    unit_id: str
    day_of_week: int
    quantity_increment: float
    enabled: bool

# Stock Entry
class StockEntryCreate(BaseModel):
    item_id: str
    quantity: float
    unit_id: str

class StockEntryResponse(BaseModel):
    id: str
    item_id: str
    item_name: Optional[str] = ""
    quantity: float
    unit_id: str
    entry_date: str
    created_at: str

# Order
class OrderItemCreate(BaseModel):
    item_id: str
    item_name: str
    section_id: str
    section_name: str
    unit_of_measure: str
    calculated_quantity: int
    adjusted_quantity: int

class OrderCreate(BaseModel):
    unit_id: str
    target_date: str
    items: List[OrderItemCreate]
    notes: Optional[str] = ""

class OrderResponse(BaseModel):
    id: str
    order_number: str  # Format: MK-2026-001
    unit_id: str
    unit_name: Optional[str] = ""
    company_id: str
    target_date: str
    items: List[dict]
    status: str  # pending, completed
    notes: str
    created_by: str
    created_by_name: Optional[str] = ""
    created_at: str
    completed_at: Optional[str] = None

# Order Amendment (changes after completion)
class OrderAmendmentCreate(BaseModel):
    order_id: str
    items: List[OrderItemCreate]
    notes: Optional[str] = ""

# Settings - Email recipients for sharing
class SettingsUpdate(BaseModel):
    email_recipients: List[str] = []

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, company_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "company_id": company_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

# ==================== COMPANY ROUTES ====================

@api_router.get("/companies", response_model=List[CompanyResponse])
async def get_companies(user: dict = Depends(get_current_user)):
    companies = await db.companies.find({}, {"_id": 0}).to_list(100)
    return [CompanyResponse(**c) for c in companies]

@api_router.get("/companies/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: str, user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyResponse(**company)

@api_router.post("/companies", response_model=CompanyResponse)
async def create_company(company: CompanyCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    company_doc = {
        "id": str(uuid.uuid4()),
        "name": company.name,
        "logo_url": company.logo_url or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company_doc)
    return CompanyResponse(**company_doc)

@api_router.put("/companies/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: str, company: CompanyCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await db.companies.update_one(
        {"id": company_id},
        {"$set": {"name": company.name, "logo_url": company.logo_url}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    updated = await db.companies.find_one({"id": company_id}, {"_id": 0})
    return CompanyResponse(**updated)

@api_router.post("/companies/{company_id}/logo")
async def upload_company_logo(company_id: str, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_admin(user)
    
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Save file
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"logo_{company_id}.{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update company
    logo_url = f"/api/uploads/{filename}"
    await db.companies.update_one({"id": company_id}, {"$set": {"logo_url": logo_url}})
    
    return {"logo_url": logo_url}

@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if company exists
    company = await db.companies.find_one({"id": user.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # First user of a company becomes admin
    existing_users = await db.users.count_documents({"company_id": user.company_id})
    role = "admin" if existing_users == 0 else user.role
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "company_id": user.company_id,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_doc["id"], user_doc["email"], user_doc["company_id"], user_doc["role"])
    return {
        "token": token,
        "user": {
            "id": user_doc["id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
            "company_id": user_doc["company_id"],
            "company_name": company["name"],
            "role": user_doc["role"]
        }
    }

@api_router.post("/auth/register-first", response_model=dict)
async def register_first_user(email: EmailStr, password: str, name: str, company_name: str):
    """Register first user and create their company"""
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create company
    company_id = str(uuid.uuid4())
    company_doc = {
        "id": company_id,
        "name": company_name,
        "logo_url": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company_doc)
    
    # Create admin user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "company_id": company_id,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, email, company_id, "admin")
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "company_id": company_id,
            "company_name": company_name,
            "role": "admin"
        },
        "company": {
            "id": company_id,
            "name": company_name,
            "logo_url": "",
            "created_at": company_doc["created_at"]
        }
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    
    token = create_token(user["id"], user["email"], user["company_id"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "company_id": user["company_id"],
            "company_name": company["name"] if company else "",
            "role": user["role"]
        }
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        company_id=user["company_id"],
        company_name=company["name"] if company else "",
        role=user["role"],
        created_at=user["created_at"]
    )

@api_router.put("/auth/password")
async def change_password(data: PasswordChange, user: dict = Depends(get_current_user)):
    if not verify_password(data.current_password, user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password": hash_password(data.new_password)}}
    )
    return {"message": "Password changed successfully"}

@api_router.post("/auth/reset-password")
async def reset_password(email: EmailStr, new_password: str):
    """Reset password for a user by email (simplified - no email verification)"""
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Email not found")
    
    await db.users.update_one(
        {"email": email},
        {"$set": {"password": hash_password(new_password)}}
    )
    return {"message": "Password reset successfully. You can now login with your new password."}

# ==================== USER MANAGEMENT (Admin) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(get_current_user)):
    require_admin(user)
    users = await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password": 0}).to_list(100)
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    return [UserResponse(**{**u, "company_name": company["name"] if company else ""}) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(new_user: UserCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    existing = await db.users.find_one({"email": new_user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": new_user.email,
        "password": hash_password(new_user.password),
        "name": new_user.name,
        "company_id": user["company_id"],  # Same company as admin
        "role": new_user.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    return UserResponse(**{**user_doc, "company_name": company["name"] if company else ""})

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.users.update_one({"id": user_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    company = await db.companies.find_one({"id": updated["company_id"]}, {"_id": 0})
    return UserResponse(**{**updated, "company_name": company["name"] if company else ""})

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ==================== UNITS ROUTES ====================

@api_router.get("/units", response_model=List[UnitResponse])
async def get_units(user: dict = Depends(get_current_user)):
    units = await db.units.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)
    return [UnitResponse(**u) for u in units]

@api_router.post("/units", response_model=UnitResponse)
async def create_unit(unit: UnitCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    unit_doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "name": unit.name,
        "initials": unit.initials.upper(),
        "address": unit.address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.units.insert_one(unit_doc)
    return UnitResponse(**unit_doc)

@api_router.put("/units/{unit_id}", response_model=UnitResponse)
async def update_unit(unit_id: str, unit: UnitCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await db.units.update_one(
        {"id": unit_id, "company_id": user["company_id"]},
        {"$set": {"name": unit.name, "initials": unit.initials.upper(), "address": unit.address}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    updated = await db.units.find_one({"id": unit_id}, {"_id": 0})
    return UnitResponse(**updated)

@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await db.units.delete_one({"id": unit_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"message": "Unit deleted"}

# ==================== SECTIONS ROUTES ====================

@api_router.get("/sections", response_model=List[SectionResponse])
async def get_sections(user: dict = Depends(get_current_user)):
    sections = await db.sections.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)
    return [SectionResponse(**s) for s in sections]

@api_router.post("/sections", response_model=SectionResponse)
async def create_section(section: SectionCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    section_doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "name": section.name,
        "description": section.description,
        "icon": section.icon,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sections.insert_one(section_doc)
    return SectionResponse(**section_doc)

@api_router.put("/sections/{section_id}", response_model=SectionResponse)
async def update_section(section_id: str, section: SectionCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await db.sections.update_one(
        {"id": section_id, "company_id": user["company_id"]},
        {"$set": {"name": section.name, "description": section.description, "icon": section.icon}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    updated = await db.sections.find_one({"id": section_id}, {"_id": 0})
    return SectionResponse(**updated)

@api_router.delete("/sections/{section_id}")
async def delete_section(section_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    result = await db.sections.delete_one({"id": section_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    return {"message": "Section deleted"}

# ==================== ITEMS ROUTES ====================

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(user: dict = Depends(get_current_user)):
    items = await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)}
    result = []
    for item in items:
        item["section_name"] = sections.get(item.get("section_id", ""), "")
        result.append(ItemResponse(**item))
    return result

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, user: dict = Depends(get_current_user)):
    section = await db.sections.find_one({"id": item.section_id, "company_id": user["company_id"]}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    item_doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "name": item.name,
        "section_id": item.section_id,
        "unit_of_measure": item.unit_of_measure,
        "minimum_stock": item.minimum_stock,
        "average_consumption": item.average_consumption,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.items.insert_one(item_doc)
    item_doc["section_name"] = section["name"]
    return ItemResponse(**item_doc)

@api_router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, item: ItemCreate, user: dict = Depends(get_current_user)):
    result = await db.items.update_one(
        {"id": item_id, "company_id": user["company_id"]},
        {"$set": {
            "name": item.name,
            "section_id": item.section_id,
            "unit_of_measure": item.unit_of_measure,
            "minimum_stock": item.minimum_stock,
            "average_consumption": item.average_consumption
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    updated = await db.items.find_one({"id": item_id}, {"_id": 0})
    section = await db.sections.find_one({"id": updated["section_id"]}, {"_id": 0})
    updated["section_name"] = section["name"] if section else ""
    return ItemResponse(**updated)

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.items.delete_one({"id": item_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# ==================== SAFETY STOCK ROUTES ====================

@api_router.get("/safety-stock/{unit_id}", response_model=List[SafetyStockResponse])
async def get_safety_stock(unit_id: str, user: dict = Depends(get_current_user)):
    configs = await db.safety_stock.find({"unit_id": unit_id}, {"_id": 0}).to_list(7)
    
    # If no configs exist, create defaults
    if not configs:
        for day in range(7):
            config = {
                "id": str(uuid.uuid4()),
                "unit_id": unit_id,
                "day_of_week": day,
                "quantity_increment": 5 if day in [4, 5] else 0,  # Friday, Saturday higher
                "enabled": True
            }
            await db.safety_stock.insert_one(config)
        configs = await db.safety_stock.find({"unit_id": unit_id}, {"_id": 0}).to_list(7)
    
    return [SafetyStockResponse(**c) for c in configs]

@api_router.put("/safety-stock/{unit_id}")
async def update_safety_stock(unit_id: str, configs: List[SafetyStockCreate], user: dict = Depends(get_current_user)):
    require_admin(user)
    for config in configs:
        await db.safety_stock.update_one(
            {"unit_id": unit_id, "day_of_week": config.day_of_week},
            {"$set": {"quantity_increment": config.quantity_increment, "enabled": config.enabled}},
            upsert=True
        )
    return {"message": "Safety stock updated"}

# ==================== STOCK ENTRIES ROUTES ====================

@api_router.get("/stock-entries/{unit_id}", response_model=List[StockEntryResponse])
async def get_stock_entries(unit_id: str, date: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"unit_id": unit_id}
    if date:
        query["entry_date"] = date
    
    entries = await db.stock_entries.find(query, {"_id": 0}).sort("entry_date", -1).to_list(1000)
    items = {i["id"]: i["name"] for i in await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)}
    
    result = []
    for entry in entries:
        entry["item_name"] = items.get(entry.get("item_id", ""), "")
        result.append(StockEntryResponse(**entry))
    return result

@api_router.get("/stock-entries/{unit_id}/latest", response_model=List[StockEntryResponse])
async def get_latest_stock_entries(unit_id: str, user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"unit_id": unit_id}},
        {"$sort": {"entry_date": -1, "created_at": -1}},
        {"$group": {
            "_id": "$item_id",
            "id": {"$first": "$id"},
            "item_id": {"$first": "$item_id"},
            "quantity": {"$first": "$quantity"},
            "unit_id": {"$first": "$unit_id"},
            "entry_date": {"$first": "$entry_date"},
            "created_at": {"$first": "$created_at"}
        }},
        {"$project": {"_id": 0}}
    ]
    entries = await db.stock_entries.aggregate(pipeline).to_list(1000)
    items = {i["id"]: i["name"] for i in await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)}
    
    result = []
    for entry in entries:
        entry["item_name"] = items.get(entry.get("item_id", ""), "")
        result.append(StockEntryResponse(**entry))
    return result

@api_router.post("/stock-entries", response_model=List[StockEntryResponse])
async def create_stock_entries(entries: List[StockEntryCreate], user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results = []
    items = {i["id"]: i["name"] for i in await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)}
    
    for entry in entries:
        existing = await db.stock_entries.find_one({
            "item_id": entry.item_id,
            "unit_id": entry.unit_id,
            "entry_date": today
        }, {"_id": 0})
        
        if existing:
            await db.stock_entries.update_one(
                {"id": existing["id"]},
                {"$set": {"quantity": entry.quantity}}
            )
            existing["quantity"] = entry.quantity
            existing["item_name"] = items.get(entry.item_id, "")
            results.append(StockEntryResponse(**existing))
        else:
            entry_doc = {
                "id": str(uuid.uuid4()),
                "item_id": entry.item_id,
                "quantity": entry.quantity,
                "unit_id": entry.unit_id,
                "entry_date": today,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.stock_entries.insert_one(entry_doc)
            entry_doc["item_name"] = items.get(entry.item_id, "")
            results.append(StockEntryResponse(**entry_doc))
    
    await update_average_consumption(user["company_id"])
    return results

async def update_average_consumption(company_id: str):
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    
    pipeline = [
        {"$match": {"entry_date": {"$gte": seven_days_ago}}},
        {"$sort": {"entry_date": 1}},
        {"$group": {
            "_id": {"item_id": "$item_id", "unit_id": "$unit_id"},
            "entries": {"$push": {"quantity": "$quantity", "date": "$entry_date"}}
        }}
    ]
    
    results = await db.stock_entries.aggregate(pipeline).to_list(1000)
    
    for result in results:
        entries = result["entries"]
        if len(entries) >= 2:
            total_consumption = 0
            for i in range(1, len(entries)):
                diff = entries[i-1]["quantity"] - entries[i]["quantity"]
                if diff > 0:
                    total_consumption += diff
            avg_consumption = total_consumption / (len(entries) - 1) if len(entries) > 1 else 0
            
            await db.items.update_one(
                {"id": result["_id"]["item_id"], "company_id": company_id},
                {"$set": {"average_consumption": round(avg_consumption, 2)}}
            )

# ==================== ORDER NUMBER GENERATION ====================

async def generate_order_number(unit_id: str) -> str:
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    initials = unit.get("initials", "XX")
    year = datetime.now(timezone.utc).year
    
    # Get last order number for this unit and year
    last_order = await db.orders.find_one(
        {"unit_id": unit_id, "order_number": {"$regex": f"^{initials}-{year}-"}},
        {"_id": 0},
        sort=[("order_number", -1)]
    )
    
    if last_order:
        try:
            last_num = int(last_order["order_number"].split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    
    return f"{initials}-{year}-{next_num:03d}"

# ==================== ORDERS ROUTES ====================

@api_router.get("/orders/{unit_id}", response_model=List[OrderResponse])
async def get_orders(unit_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"unit_id": unit_id, "company_id": user["company_id"]}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    units = {u["id"]: u["name"] for u in await db.units.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)}
    users_map = {u["id"]: u["name"] for u in await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password": 0}).to_list(100)}
    
    result = []
    for order in orders:
        order["unit_name"] = units.get(order.get("unit_id", ""), "")
        order["created_by_name"] = users_map.get(order.get("created_by", ""), "")
        result.append(OrderResponse(**order))
    return result

@api_router.get("/orders/{unit_id}/calculate")
async def calculate_order(unit_id: str, target_date: str, user: dict = Depends(get_current_user)):
    target = datetime.strptime(target_date, "%Y-%m-%d")
    day_of_week = target.weekday()
    
    # Get safety stock config for target day
    safety_config = await db.safety_stock.find_one(
        {"unit_id": unit_id, "day_of_week": day_of_week},
        {"_id": 0}
    )
    quantity_increment = safety_config["quantity_increment"] if safety_config and safety_config.get("enabled") else 0
    
    # Get all items with sections
    items = await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)}
    
    # Get latest stock entries
    latest_entries = {}
    pipeline = [
        {"$match": {"unit_id": unit_id}},
        {"$sort": {"entry_date": -1}},
        {"$group": {
            "_id": "$item_id",
            "quantity": {"$first": "$quantity"}
        }}
    ]
    for entry in await db.stock_entries.aggregate(pipeline).to_list(1000):
        latest_entries[entry["_id"]] = entry["quantity"]
    
    # Calculate order items
    order_items = []
    for item in items:
        current_stock = latest_entries.get(item["id"], 0)
        minimum_stock = item.get("minimum_stock", 0)
        avg_consumption = item.get("average_consumption", 0)
        
        # Adjusted minimum = base minimum + day increment
        adjusted_minimum = minimum_stock + quantity_increment
        
        # Calculation: (Adjusted Minimum + Average Consumption) - Current Stock
        needed = (adjusted_minimum + avg_consumption) - current_stock
        needed_rounded = max(0, round(needed))  # Round to integer, no decimals
        
        if needed_rounded > 0:
            order_items.append({
                "item_id": item["id"],
                "item_name": item["name"],
                "section_id": item["section_id"],
                "section_name": sections.get(item["section_id"], ""),
                "unit_of_measure": item["unit_of_measure"],
                "current_stock": current_stock,
                "minimum_stock": minimum_stock,
                "adjusted_minimum": adjusted_minimum,
                "average_consumption": avg_consumption,
                "quantity_increment": quantity_increment,
                "calculated_quantity": needed_rounded,
                "adjusted_quantity": needed_rounded
            })
    
    order_items.sort(key=lambda x: x["section_name"])
    
    return {
        "target_date": target_date,
        "quantity_increment": quantity_increment,
        "items": order_items
    }

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": order.unit_id, "company_id": user["company_id"]}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    
    order_number = await generate_order_number(order.unit_id)
    
    order_doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "unit_id": order.unit_id,
        "company_id": user["company_id"],
        "target_date": order.target_date,
        "items": [item.model_dump() for item in order.items],
        "status": "pending",
        "notes": order.notes,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.orders.insert_one(order_doc)
    order_doc["unit_name"] = unit["name"]
    order_doc["created_by_name"] = user["name"]
    return OrderResponse(**order_doc)

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user: dict = Depends(get_current_user)):
    update_data = {"status": status}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one(
        {"id": order_id, "company_id": user["company_id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": f"Order status updated to {status}"}

@api_router.post("/orders/{order_id}/amendment", response_model=OrderResponse)
async def create_order_amendment(order_id: str, amendment: OrderAmendmentCreate, user: dict = Depends(get_current_user)):
    """Create amendment order for changes after original order is completed"""
    original = await db.orders.find_one({"id": order_id, "company_id": user["company_id"]}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Original order not found")
    
    if original["status"] != "completed":
        raise HTTPException(status_code=400, detail="Can only amend completed orders")
    
    unit = await db.units.find_one({"id": original["unit_id"]}, {"_id": 0})
    order_number = await generate_order_number(original["unit_id"])
    
    amendment_doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "unit_id": original["unit_id"],
        "company_id": user["company_id"],
        "target_date": original["target_date"],
        "items": [item.model_dump() for item in amendment.items],
        "status": "pending",
        "notes": f"Amendment to {original['order_number']}. {amendment.notes or ''}",
        "created_by": user["id"],
        "parent_order_id": order_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.orders.insert_one(amendment_doc)
    amendment_doc["unit_name"] = unit["name"] if unit else ""
    amendment_doc["created_by_name"] = user["name"]
    return OrderResponse(**amendment_doc)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(get_current_user)):
    result = await db.orders.delete_one({"id": order_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted"}

# ==================== PDF GENERATION ====================

async def generate_pdf_content(title: str, subtitle: str, data: list, columns: list, user_name: str, company_name: str, logo_url: str = None):
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, spaceAfter=10, textColor=colors.HexColor('#0f172a'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, spaceAfter=5, textColor=colors.HexColor('#64748b'))
    
    elements = []
    
    # Header with company name
    elements.append(Paragraph(company_name.upper(), title_style))
    elements.append(Paragraph(title, styles['Heading2']))
    elements.append(Paragraph(subtitle, subtitle_style))
    
    now = datetime.now(timezone.utc)
    elements.append(Paragraph(f"Generated: {now.strftime('%Y-%m-%d %H:%M:%S')} UTC", subtitle_style))
    elements.append(Paragraph(f"Generated by: {user_name}", subtitle_style))
    elements.append(Spacer(1, 20))
    
    if data:
        # Create table
        table_data = [columns]
        for row in data:
            table_data.append([str(row.get(col.lower().replace(' ', '_'), '')) for col in columns])
        
        col_widths = [6.5*inch / len(columns)] * len(columns)
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No data available", styles['Normal']))
    
    doc.build(elements)
    return buffer.getvalue()

@api_router.get("/orders/{order_id}/pdf")
async def generate_order_pdf(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "company_id": user["company_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    unit = await db.units.find_one({"id": order["unit_id"]}, {"_id": 0})
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    creator = await db.users.find_one({"id": order.get("created_by", "")}, {"_id": 0, "password": 0})
    
    unit_name = unit["name"] if unit else "Unknown"
    company_name = company["name"] if company else "Company"
    creator_name = creator["name"] if creator else "Unknown"
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, spaceAfter=10, textColor=colors.HexColor('#0f172a'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, spaceAfter=5, textColor=colors.HexColor('#64748b'))
    
    elements = []
    
    # Header
    elements.append(Paragraph(company_name.upper(), title_style))
    elements.append(Paragraph(f"Purchase Order - {unit_name}", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    # Order info
    created_at = datetime.fromisoformat(order['created_at'].replace('Z', '+00:00'))
    elements.append(Paragraph(f"Order Number: {order['order_number']}", subtitle_style))
    elements.append(Paragraph(f"Target Date: {order['target_date']}", subtitle_style))
    elements.append(Paragraph(f"Created: {created_at.strftime('%Y-%m-%d %H:%M:%S')} UTC", subtitle_style))
    elements.append(Paragraph(f"Created by: {creator_name}", subtitle_style))
    elements.append(Spacer(1, 20))
    
    # Group items by section
    sections_dict = {}
    for item in order["items"]:
        section = item.get("section_name", "Other")
        if section not in sections_dict:
            sections_dict[section] = []
        sections_dict[section].append(item)
    
    # Create table for each section
    for section_name, items in sections_dict.items():
        elements.append(Paragraph(section_name, styles['Heading3']))
        elements.append(Spacer(1, 5))
        
        table_data = [["Item", "Quantity", "Unit"]]
        for item in items:
            table_data.append([
                item["item_name"],
                str(int(item["adjusted_quantity"])),  # No decimals
                item["unit_of_measure"]
            ])
        
        table = Table(table_data, colWidths=[4*inch, 1.5*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 15))
    
    # Notes
    if order.get("notes"):
        elements.append(Paragraph("Notes:", styles['Heading4']))
        elements.append(Paragraph(order["notes"], styles['Normal']))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return {
        "pdf_base64": base64.b64encode(pdf_data).decode(),
        "filename": f"order_{order['order_number']}_{order['target_date']}.pdf",
        "share_title": f"Purchase Order {order['order_number']} - {company_name}",
        "share_text": f"Purchase Order for {unit_name} - Target: {order['target_date']} - Created: {created_at.strftime('%Y-%m-%d %H:%M')}"
    }

# ==================== REPORTS ====================

@api_router.get("/reports/dashboard/{unit_id}")
async def get_dashboard_stats(unit_id: str, user: dict = Depends(get_current_user)):
    total_items = await db.items.count_documents({"company_id": user["company_id"]})
    
    pipeline = [
        {"$match": {"unit_id": unit_id}},
        {"$sort": {"entry_date": -1}},
        {"$group": {
            "_id": "$item_id",
            "quantity": {"$first": "$quantity"}
        }}
    ]
    latest_entries = {e["_id"]: e["quantity"] for e in await db.stock_entries.aggregate(pipeline).to_list(1000)}
    
    items = await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    low_stock_count = 0
    critical_stock_count = 0
    
    for item in items:
        current = latest_entries.get(item["id"], 0)
        minimum = item.get("minimum_stock", 0)
        if minimum > 0:
            ratio = current / minimum
            if ratio < 0.5:
                critical_stock_count += 1
            elif ratio < 1:
                low_stock_count += 1
    
    pending_orders = await db.orders.count_documents({"unit_id": unit_id, "company_id": user["company_id"], "status": "pending"})
    completed_orders = await db.orders.count_documents({"unit_id": unit_id, "company_id": user["company_id"], "status": "completed"})
    sections_count = await db.sections.count_documents({"company_id": user["company_id"]})
    
    return {
        "total_items": total_items,
        "low_stock_count": low_stock_count,
        "critical_stock_count": critical_stock_count,
        "pending_orders": pending_orders,
        "completed_orders": completed_orders,
        "sections_count": sections_count
    }

@api_router.get("/reports/stock-status/{unit_id}")
async def get_stock_status_report(unit_id: str, user: dict = Depends(get_current_user)):
    items = await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)}
    
    pipeline = [
        {"$match": {"unit_id": unit_id}},
        {"$sort": {"entry_date": -1}},
        {"$group": {
            "_id": "$item_id",
            "quantity": {"$first": "$quantity"},
            "entry_date": {"$first": "$entry_date"}
        }}
    ]
    latest_entries = {e["_id"]: {"quantity": e["quantity"], "date": e["entry_date"]} for e in await db.stock_entries.aggregate(pipeline).to_list(1000)}
    
    result = []
    for item in items:
        entry = latest_entries.get(item["id"], {"quantity": 0, "date": None})
        current = entry["quantity"]
        minimum = item.get("minimum_stock", 0)
        
        status = "ok"
        if minimum > 0:
            ratio = current / minimum
            if ratio < 0.5:
                status = "critical"
            elif ratio < 1:
                status = "low"
        
        result.append({
            "item_id": item["id"],
            "item_name": item["name"],
            "section_name": sections.get(item["section_id"], ""),
            "unit_of_measure": item["unit_of_measure"],
            "current_stock": current,
            "minimum_stock": minimum,
            "average_consumption": item.get("average_consumption", 0),
            "status": status,
            "last_entry_date": entry["date"]
        })
    
    result.sort(key=lambda x: (0 if x["status"] == "critical" else 1 if x["status"] == "low" else 2, x["section_name"]))
    return result

@api_router.get("/reports/stock-status/{unit_id}/pdf")
async def get_stock_status_pdf(unit_id: str, user: dict = Depends(get_current_user)):
    data = await get_stock_status_report(unit_id, user)
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    
    pdf_data = await generate_pdf_content(
        title=f"Stock Status Report - {unit['name'] if unit else 'Unknown'}",
        subtitle=f"As of {datetime.now(timezone.utc).strftime('%Y-%m-%d')}",
        data=data,
        columns=["Item Name", "Section Name", "Current Stock", "Minimum Stock", "Status"],
        user_name=user["name"],
        company_name=company["name"] if company else "Company"
    )
    
    return {
        "pdf_base64": base64.b64encode(pdf_data).decode(),
        "filename": f"stock_status_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf",
        "share_title": f"Stock Status Report - {company['name'] if company else 'Company'}",
        "share_text": f"Stock Status for {unit['name'] if unit else 'Unit'} - Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    }

@api_router.get("/reports/consumption/{unit_id}")
async def get_consumption_report(unit_id: str, days: int = 30, user: dict = Depends(get_current_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    entries = await db.stock_entries.find(
        {"unit_id": unit_id, "entry_date": {"$gte": start_date}},
        {"_id": 0}
    ).sort("entry_date", 1).to_list(10000)
    
    items = {i["id"]: i for i in await db.items.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(1000)}
    sections = {s["id"]: s["name"] for s in await db.sections.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)}
    
    item_entries = {}
    for entry in entries:
        item_id = entry["item_id"]
        if item_id not in item_entries:
            item_entries[item_id] = []
        item_entries[item_id].append(entry)
    
    result = []
    for item_id, item_data in items.items():
        entries = item_entries.get(item_id, [])
        total_consumption = 0
        days_count = 0
        
        for i in range(1, len(entries)):
            diff = entries[i-1]["quantity"] - entries[i]["quantity"]
            if diff > 0:
                total_consumption += diff
                days_count += 1
        
        avg_daily = total_consumption / days_count if days_count > 0 else 0
        
        result.append({
            "item_id": item_id,
            "item_name": item_data["name"],
            "section_name": sections.get(item_data["section_id"], ""),
            "unit_of_measure": item_data["unit_of_measure"],
            "total_consumption": round(total_consumption, 2),
            "average_daily": round(avg_daily, 2),
            "entries_count": len(entries)
        })
    
    result.sort(key=lambda x: x["total_consumption"], reverse=True)
    return result

@api_router.get("/reports/consumption/{unit_id}/pdf")
async def get_consumption_pdf(unit_id: str, days: int = 30, user: dict = Depends(get_current_user)):
    data = await get_consumption_report(unit_id, days, user)
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    
    pdf_data = await generate_pdf_content(
        title=f"Consumption Report - {unit['name'] if unit else 'Unknown'}",
        subtitle=f"Last {days} days",
        data=data,
        columns=["Item Name", "Section Name", "Total Consumption", "Average Daily", "Entries Count"],
        user_name=user["name"],
        company_name=company["name"] if company else "Company"
    )
    
    return {
        "pdf_base64": base64.b64encode(pdf_data).decode(),
        "filename": f"consumption_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf",
        "share_title": f"Consumption Report - {company['name'] if company else 'Company'}",
        "share_text": f"Consumption for {unit['name'] if unit else 'Unit'} (Last {days} days) - Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    }

@api_router.get("/reports/orders-history/{unit_id}")
async def get_orders_history(
    unit_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"unit_id": unit_id, "company_id": user["company_id"]}
    if start_date:
        query["target_date"] = {"$gte": start_date}
    if end_date:
        if "target_date" in query:
            query["target_date"]["$lte"] = end_date
        else:
            query["target_date"] = {"$lte": end_date}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("target_date", -1).to_list(1000)
    
    total_orders = len(orders)
    pending_count = sum(1 for o in orders if o["status"] == "pending")
    completed_count = sum(1 for o in orders if o["status"] == "completed")
    
    return {
        "orders": orders,
        "summary": {
            "total": total_orders,
            "pending": pending_count,
            "completed": completed_count
        }
    }

@api_router.get("/reports/orders-history/{unit_id}/pdf")
async def get_orders_history_pdf(
    unit_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    report = await get_orders_history(unit_id, start_date, end_date, user)
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    
    data = []
    for order in report["orders"]:
        data.append({
            "order_number": order["order_number"],
            "target_date": order["target_date"],
            "items_count": str(len(order["items"])),
            "status": order["status"],
            "created_at": order["created_at"][:19]
        })
    
    pdf_data = await generate_pdf_content(
        title=f"Orders History - {unit['name'] if unit else 'Unknown'}",
        subtitle=f"Period: {start_date or 'All'} to {end_date or 'Present'}",
        data=data,
        columns=["Order Number", "Target Date", "Items Count", "Status", "Created At"],
        user_name=user["name"],
        company_name=company["name"] if company else "Company"
    )
    
    return {
        "pdf_base64": base64.b64encode(pdf_data).decode(),
        "filename": f"orders_history_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.pdf",
        "share_title": f"Orders History - {company['name'] if company else 'Company'}",
        "share_text": f"Orders for {unit['name'] if unit else 'Unit'} - Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}"
    }

# ==================== SETTINGS ====================

@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"company_id": user["company_id"]}, {"_id": 0})
    if not settings:
        settings = {
            "id": str(uuid.uuid4()),
            "company_id": user["company_id"],
            "email_recipients": []
        }
        await db.settings.insert_one(settings)
    return settings

@api_router.put("/settings")
async def update_settings(update: SettingsUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    await db.settings.update_one(
        {"company_id": user["company_id"]},
        {"$set": {"email_recipients": update.email_recipients}},
        upsert=True
    )
    return {"message": "Settings updated"}

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data(user: dict = Depends(get_current_user)):
    existing_sections = await db.sections.count_documents({"company_id": user["company_id"]})
    if existing_sections > 0:
        return {"message": "Data already seeded"}
    
    sections = [
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Freezer", "description": "Frozen products", "icon": "Snowflake", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Meats", "description": "Fresh meats and proteins", "icon": "Beef", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Produce", "description": "Fresh fruits and vegetables", "icon": "Carrot", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Grocery", "description": "Dry goods and pantry items", "icon": "ShoppingBasket", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Dairy", "description": "Milk, cheese, and dairy products", "icon": "Milk", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.sections.insert_many(sections)
    
    items = [
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Frozen Shrimp", "section_id": sections[0]["id"], "unit_of_measure": "kg", "minimum_stock": 5, "average_consumption": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Ice Cream", "section_id": sections[0]["id"], "unit_of_measure": "l", "minimum_stock": 10, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Chicken Breast", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Ground Beef", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 8, "average_consumption": 4, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Pork Loin", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 6, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Tomatoes", "section_id": sections[2]["id"], "unit_of_measure": "kg", "minimum_stock": 15, "average_consumption": 8, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Lettuce", "section_id": sections[2]["id"], "unit_of_measure": "un", "minimum_stock": 20, "average_consumption": 10, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Onions", "section_id": sections[2]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Olive Oil", "section_id": sections[3]["id"], "unit_of_measure": "l", "minimum_stock": 5, "average_consumption": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Pasta", "section_id": sections[3]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Rice", "section_id": sections[3]["id"], "unit_of_measure": "kg", "minimum_stock": 15, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Milk", "section_id": sections[4]["id"], "unit_of_measure": "l", "minimum_stock": 20, "average_consumption": 10, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Butter", "section_id": sections[4]["id"], "unit_of_measure": "kg", "minimum_stock": 5, "average_consumption": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "company_id": user["company_id"], "name": "Parmesan Cheese", "section_id": sections[4]["id"], "unit_of_measure": "kg", "minimum_stock": 3, "average_consumption": 1, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.items.insert_many(items)
    
    return {"message": "Data seeded successfully", "sections": len(sections), "items": len(items)}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Kitchen Inventory API", "version": "2.0.0"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
