from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import math
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import bcrypt
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.units import inch
from io import BytesIO
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
DEFAULT_LOGO = ROOT_DIR / 'assets' / 'logo.png'   # logo usado na fatura quando a loja não enviou outro

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'vape-store-secret-key-dev')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Master key to protect company creation and super-admin operations
MASTER_KEY = os.environ.get('MASTER_KEY', '')

# Upload directory

# Create the main app
app = FastAPI(title="Vape Store API", version="3.0.0")

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
    active: bool = True

# User
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    company_id: str
    role: str = "user"  # admin, user

class AdminUserCreate(BaseModel):
    """Model for admin creating users - company_id is inherited from the admin"""
    email: EmailStr
    password: str
    name: str
    role: str = "user"  # admin, user
    unit_ids: List[str] = []
    commission_type: Literal["fixed", "percent"] = "fixed"   # fixed = valor por venda
    commission_value: float = Field(5.0, ge=0)

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
    unit_ids: List[str] = []
    commission_type: str = "fixed"
    commission_value: float = 5.0
    created_at: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    unit_ids: Optional[List[str]] = None
    commission_type: Optional[Literal["fixed", "percent"]] = None
    commission_value: Optional[float] = Field(None, ge=0)

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
        # Block access if company is inactive
        company = await db.companies.find_one({"id": user.get("company_id")}, {"_id": 0})
        if company and not company.get("active", True):
            raise HTTPException(status_code=403, detail="Company account is inactive. Contact the administrator.")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired")

def require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

def check_commission(ctype: str, value: float):
    if ctype == "percent" and value > 100:
        raise HTTPException(status_code=400, detail="Comissão em porcentagem não pode passar de 100%")

# ==================== COMPANY ROUTES ====================

@api_router.get("/companies", response_model=List[CompanyResponse])
async def get_companies():
    """Public route - used by login page to list available companies"""
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

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be smaller than 2MB")

    # Salvar como base64 no MongoDB (funciona no Render free tier sem disco persistente)
    b64 = base64.b64encode(contents).decode("utf-8")
    logo_url = f"data:{file.content_type};base64,{b64}"

    await db.companies.update_one({"id": company_id}, {"$set": {"logo_url": logo_url}})
    return {"logo_url": logo_url}

@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    # Mantido por compatibilidade; uploads agora sao base64 no MongoDB
    raise HTTPException(status_code=404, detail="File not found")

# ==================== SUPER-ADMIN ROUTES (protected by MASTER_KEY) ====================

@api_router.get("/superadmin/companies")
async def superadmin_list_companies(master_key: str = ""):
    """List all companies with user counts - requires MASTER_KEY"""
    if not MASTER_KEY or master_key != MASTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid master key")
    companies = await db.companies.find({}, {"_id": 0}).to_list(500)
    result = []
    for c in companies:
        user_count = await db.users.count_documents({"company_id": c["id"]})
        result.append({**c, "user_count": user_count})
    return result

@api_router.patch("/superadmin/companies/{company_id}/toggle")
async def superadmin_toggle_company(company_id: str, master_key: str = ""):
    """Activate or deactivate a company - requires MASTER_KEY"""
    if not MASTER_KEY or master_key != MASTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid master key")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    new_status = not company.get("active", True)
    await db.companies.update_one({"id": company_id}, {"$set": {"active": new_status}})
    status_text = "activated" if new_status else "deactivated"
    return {"message": f"Company '{company['name']}' {status_text}", "active": new_status}

@api_router.delete("/superadmin/companies/{company_id}")
async def superadmin_delete_company(company_id: str, master_key: str = ""):
    """Delete a company and all its data - requires MASTER_KEY"""
    if not MASTER_KEY or master_key != MASTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid master key")
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    # Delete all company data
    await db.users.delete_many({"company_id": company_id})
    await db.companies.delete_one({"id": company_id})
    # Delete other company data if collections exist
    for collection_name in ["products", "purchases", "sales", "stock_movements", "counters", "units", "settings"]:
        try:
            collection = db[collection_name]
            await collection.delete_many({"company_id": company_id})
        except Exception:
            pass
    return {"message": f"Company '{company['name']}' and all its data deleted successfully"}

@api_router.post("/superadmin/companies")
async def superadmin_create_company(
    company_name: str,
    admin_email: EmailStr,
    admin_password: str,
    admin_name: str,
    master_key: str = ""
):
    """Create a new company with admin user - requires MASTER_KEY"""
    if not MASTER_KEY or master_key != MASTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid master key")
    existing = await db.users.find_one({"email": admin_email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    company_id = str(uuid.uuid4())
    company_doc = {
        "id": company_id,
        "name": company_name,
        "logo_url": "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.companies.insert_one(company_doc)
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": admin_email,
        "password": hash_password(admin_password),
        "name": admin_name,
        "company_id": company_id,
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    return {"message": "Company and admin user created", "company_id": company_id, "company_name": company_name}

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
async def register_first_user(email: EmailStr, password: str, name: str, company_name: str, master_key: str = ""):
    """Register first user and create their company - requires MASTER_KEY"""
    # Validate master key if configured
    if MASTER_KEY and master_key != MASTER_KEY:
        raise HTTPException(status_code=403, detail="Invalid master key. Contact the system administrator.")
    
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

# /auth/reset-password removed — insecure endpoint (allowed changing any password without verification)
# Use /auth/forgot-password instead which notifies admins

# ==================== USER MANAGEMENT (Admin) ====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(user: dict = Depends(get_current_user)):
    require_admin(user)
    users = await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password": 0}).to_list(100)
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    result = []
    for u in users:
        u.setdefault("unit_ids", [])
        result.append(UserResponse(**{**u, "company_name": company["name"] if company else ""}))
    return result

@api_router.post("/users", response_model=UserResponse)
async def create_user(new_user: AdminUserCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    existing = await db.users.find_one({"email": new_user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    check_commission(new_user.commission_type, new_user.commission_value)

    user_doc = {
        "id": str(uuid.uuid4()),
        "email": new_user.email,
        "password": hash_password(new_user.password),
        "name": new_user.name,
        "company_id": user["company_id"],  # Same company as admin
        "role": new_user.role,
        "unit_ids": new_user.unit_ids if hasattr(new_user, 'unit_ids') else [],
        "commission_type": new_user.commission_type,
        "commission_value": new_user.commission_value,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0})
    return UserResponse(**{**user_doc, "company_name": company["name"] if company else ""})

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, update: UserUpdate, user: dict = Depends(get_current_user)):
    require_admin(user)
    
    # unit_ids can be empty list — include it even if empty
    raw = update.model_dump()
    update_data = {}
    for k, v in raw.items():
        if k == 'unit_ids':
            update_data[k] = v if v is not None else []
        elif v is not None:
            update_data[k] = v
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    if "commission_type" in update_data or "commission_value" in update_data:
        current = await db.users.find_one({"id": user_id, "company_id": user["company_id"]}, {"_id": 0}) or {}
        check_commission(update_data.get("commission_type", current.get("commission_type", "fixed")),
                         update_data.get("commission_value", current.get("commission_value", 5.0)))

    # Admin só altera usuários da própria empresa
    result = await db.users.update_one({"id": user_id, "company_id": user["company_id"]}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    updated.setdefault("unit_ids", [])
    company = await db.companies.find_one({"id": updated["company_id"]}, {"_id": 0})
    return UserResponse(**{**updated, "company_name": company["name"] if company else ""})

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Ensure admin can only delete users from their own company
    result = await db.users.delete_one({"id": user_id, "company_id": user["company_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# ==================== UNITS ROUTES ====================

@api_router.get("/units", response_model=List[UnitResponse])
async def get_units(user: dict = Depends(get_current_user)):
    units = await db.units.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(100)
    # If user has specific unit_ids, filter to only those
    user_unit_ids = user.get("unit_ids", [])
    if user_unit_ids and user.get("role") != "admin":
        units = [u for u in units if u["id"] in user_unit_ids]
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

# ==================== LOJA DE VAPERS: MODELOS ====================

class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = ""
    flavor: Optional[str] = ""
    puffs: Optional[int] = 0
    sku: Optional[str] = ""
    cost_price: float = Field(0, ge=0)
    sale_price: float = Field(0, ge=0)
    min_stock: int = Field(0, ge=0)
    active: bool = True

class ProductResponse(BaseModel):
    id: str
    company_id: str
    name: str
    brand: str = ""
    flavor: str = ""
    puffs: int = 0
    sku: str = ""
    cost_price: float = 0
    sale_price: float = 0
    min_stock: int = 0
    stock: int = 0
    active: bool = True
    created_at: str

class StockAdjust(BaseModel):
    new_stock: int = Field(..., ge=0)
    reason: Optional[str] = ""

class PurchaseItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_cost: float = Field(..., ge=0)

class PurchaseCreate(BaseModel):
    supplier: Optional[str] = ""
    supplier_doc: Optional[str] = ""   # número da nota/fatura do fornecedor
    items: List[PurchaseItemIn]
    notes: Optional[str] = ""
    tz_offset: int = 0                 # minutos (Date.getTimezoneOffset do navegador)

class SaleItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)
    unit_price: Optional[float] = Field(None, ge=0)  # vazio = preço de venda do produto

class SaleCreate(BaseModel):
    customer_name: Optional[str] = ""
    customer_doc: Optional[str] = ""
    customer_phone: Optional[str] = ""
    payment_method: str = "dinheiro"
    discount: float = Field(0, ge=0)
    items: List[SaleItemIn]
    notes: Optional[str] = ""
    seller_id: Optional[str] = None    # admin pode lançar a venda em nome de um funcionário
    tz_offset: int = 0

class StoreSettings(BaseModel):
    currency: str = "BRL"
    tax_id: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    invoice_footer: Optional[str] = ""

PAYMENT_METHODS = {
    "dinheiro": "Dinheiro",
    "pix": "PIX",
    "debito": "Cartão de débito",
    "credito": "Cartão de crédito",
    "transferencia": "Transferência",
    "outro": "Outro",
}

CURRENCIES = {
    # código: (símbolo, separador decimal, separador de milhar)
    "BRL": ("R$", ",", "."),
    "EUR": ("€", ",", "."),
    "USD": ("$", ".", ","),
}

# ==================== LOJA DE VAPERS: HELPERS ====================

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def money(value: float, currency: str = "BRL") -> str:
    symbol, dec, thou = CURRENCIES.get(currency, CURRENCIES["BRL"])
    txt = f"{abs(value):,.2f}".replace(",", "X").replace(".", dec).replace("X", thou)
    return f"{'-' if value < 0 else ''}{symbol} {txt}"

def to_local(iso: str, tz_offset: int = 0) -> datetime:
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt - timedelta(minutes=tz_offset)

async def next_number(company_id: str, kind: str, prefix: str) -> str:
    """Numeração sequencial por empresa/ano: FAT-2026-0001, CMP-2026-0001"""
    year = datetime.now(timezone.utc).year
    counter = await db.counters.find_one_and_update(
        {"_id": f"{company_id}:{kind}:{year}"},
        {"$inc": {"seq": 1}, "$setOnInsert": {"company_id": company_id}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return f"{prefix}-{year}-{counter['seq']:04d}"

async def get_store_settings(company_id: str) -> dict:
    doc = await db.settings.find_one({"company_id": company_id}, {"_id": 0}) or {}
    defaults = StoreSettings().model_dump()
    return {**defaults, **{k: v for k, v in doc.items() if k in defaults and v is not None}}

async def log_movement(user: dict, product: dict, quantity: int, mtype: str,
                       ref_type: str = "", ref_id: str = "", ref_number: str = "", note: str = ""):
    current = await db.products.find_one({"id": product["id"]}, {"_id": 0, "stock": 1})
    await db.stock_movements.insert_one({
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        "product_id": product["id"],
        "product_name": product["name"],
        "type": mtype,              # entrada, saida, estorno, ajuste
        "quantity": quantity,       # positivo = entra, negativo = sai
        "balance_after": (current or {}).get("stock", 0),
        "ref_type": ref_type,
        "ref_id": ref_id,
        "ref_number": ref_number,
        "note": note,
        "user_name": user.get("name", ""),
        "created_at": now_iso(),
    })

async def load_products(company_id: str, product_ids: List[str]) -> dict:
    products = await db.products.find(
        {"company_id": company_id, "id": {"$in": list(set(product_ids))}}, {"_id": 0}
    ).to_list(1000)
    found = {p["id"]: p for p in products}
    missing = [pid for pid in product_ids if pid not in found]
    if missing:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return found

def sale_commission_rule(seller: dict):
    """Regra de comissão do vendedor; padrão R$ 5,00 por venda"""
    ctype = seller.get("commission_type") or "fixed"
    cvalue = seller.get("commission_value")
    return ctype, float(5.0 if cvalue is None else cvalue)

def product_label(p: dict) -> str:
    return f"{p['name']} - {p['flavor']}" if p.get("flavor") else p["name"]

# ==================== PRODUTOS ====================

@api_router.get("/products", response_model=List[ProductResponse])
async def list_products(include_inactive: bool = True, user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if not include_inactive:
        query["active"] = True
    products = await db.products.find(query, {"_id": 0}).sort("name", 1).to_list(2000)
    return [ProductResponse(**p) for p in products]

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product: ProductCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    doc = {
        "id": str(uuid.uuid4()),
        "company_id": user["company_id"],
        **product.model_dump(),
        "stock": 0,
        "created_at": now_iso(),
    }
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return ProductResponse(**doc)

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product: ProductCreate, user: dict = Depends(get_current_user)):
    require_admin(user)
    # O estoque só muda por compra, venda ou ajuste — nunca pela edição
    result = await db.products.update_one(
        {"id": product_id, "company_id": user["company_id"]},
        {"$set": product.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return ProductResponse(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    product = await db.products.find_one({"id": product_id, "company_id": user["company_id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    has_history = await db.stock_movements.count_documents({"product_id": product_id})
    if has_history:
        # Produto com histórico é apenas desativado para não quebrar faturas antigas
        await db.products.update_one({"id": product_id}, {"$set": {"active": False}})
        return {"message": "Produto possui movimentações e foi desativado", "deactivated": True}
    await db.products.delete_one({"id": product_id})
    return {"message": "Produto excluído", "deactivated": False}

@api_router.post("/products/{product_id}/adjust", response_model=ProductResponse)
async def adjust_stock(product_id: str, data: StockAdjust, user: dict = Depends(get_current_user)):
    """Ajuste de inventário (contagem física)"""
    require_admin(user)
    product = await db.products.find_one({"id": product_id, "company_id": user["company_id"]}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    diff = data.new_stock - product.get("stock", 0)
    if diff != 0:
        await db.products.update_one({"id": product_id}, {"$inc": {"stock": diff}})
        await log_movement(user, product, diff, "ajuste", note=data.reason or "Ajuste de inventário")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return ProductResponse(**updated)

SAMPLE_VAPERS = [
    # nome, marca, sabor, puffs, custo, venda, estoque mínimo
    ("Ignite V80", "Ignite", "Menta Gelada", 8000, 45.00, 130.00, 5),
    ("Ignite V150", "Ignite", "Uva Gelada", 15000, 65.00, 130.00, 5),
    ("Elf Bar BC10000", "Elf Bar", "Melancia", 10000, 50.00, 130.00, 5),
    ("Elf Bar TE6000", "Elf Bar", "Morango com Kiwi", 6000, 38.00, 130.00, 5),
    ("Lost Mary MO5000", "Lost Mary", "Blue Razz", 5000, 35.00, 130.00, 5),
    ("Oxbar Magic Maze", "Oxbar", "Pêssego Gelado", 10000, 48.00, 130.00, 4),
    ("Waka soPro", "Waka", "Manga", 10000, 47.00, 130.00, 4),
    ("Geek Bar Pulse", "Geek Bar", "Frutas Vermelhas", 15000, 62.00, 130.00, 4),
    ("Life Pod Eco", "Life Pod", "Banana Ice", 10000, 44.00, 130.00, 4),
    ("Vaporesso XROS 4", "Vaporesso", "", 0, 120.00, 130.00, 2),
]

class BulkPrice(BaseModel):
    sale_price: float = Field(..., ge=0)

@api_router.post("/products/bulk-price")
async def bulk_price(data: BulkPrice, user: dict = Depends(get_current_user)):
    """Define o mesmo preço de venda para todos os produtos ativos"""
    require_admin(user)
    result = await db.products.update_many(
        {"company_id": user["company_id"], "active": True},
        {"$set": {"sale_price": round(data.sale_price, 2)}}
    )
    return {"message": f"Preço atualizado em {result.modified_count} produto(s)", "count": result.modified_count}

@api_router.post("/products/seed-vapers")
async def seed_vapers(user: dict = Depends(get_current_user)):
    require_admin(user)
    if await db.products.count_documents({"company_id": user["company_id"]}) > 0:
        raise HTTPException(status_code=400, detail="Já existem produtos cadastrados")
    docs = []
    for i, (name, brand, flavor, puffs, cost, price, min_stock) in enumerate(SAMPLE_VAPERS, start=1):
        docs.append({
            "id": str(uuid.uuid4()),
            "company_id": user["company_id"],
            "name": name, "brand": brand, "flavor": flavor, "puffs": puffs,
            "sku": f"VP-{i:03d}",
            "cost_price": cost, "sale_price": price, "min_stock": min_stock,
            "stock": 0, "active": True, "created_at": now_iso(),
        })
    await db.products.insert_many(docs)
    return {"message": f"{len(docs)} vapers cadastrados", "count": len(docs)}

# ==================== COMPRAS (ENTRADA DE ESTOQUE) ====================

@api_router.get("/purchases")
async def list_purchases(user: dict = Depends(get_current_user)):
    return await db.purchases.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/purchases/{purchase_id}")
async def get_purchase(purchase_id: str, user: dict = Depends(get_current_user)):
    purchase = await db.purchases.find_one({"id": purchase_id, "company_id": user["company_id"]}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    return purchase

@api_router.post("/purchases")
async def create_purchase(data: PurchaseCreate, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Adicione pelo menos um item")
    products = await load_products(user["company_id"], [i.product_id for i in data.items])

    purchase_id = str(uuid.uuid4())
    number = await next_number(user["company_id"], "purchase", "CMP")
    lines = []
    for item in data.items:
        p = products[item.product_id]
        lines.append({
            "product_id": p["id"], "product_name": product_label(p), "sku": p.get("sku", ""),
            "quantity": item.quantity, "unit_cost": round(item.unit_cost, 2),
            "total": round(item.quantity * item.unit_cost, 2),
        })

    # Entrada no estoque + custo médio ponderado
    for item in data.items:
        p = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        old_stock, old_cost = max(p.get("stock", 0), 0), p.get("cost_price", 0)
        new_cost = ((old_stock * old_cost) + (item.quantity * item.unit_cost)) / (old_stock + item.quantity)
        await db.products.update_one(
            {"id": p["id"]},
            {"$inc": {"stock": item.quantity}, "$set": {"cost_price": round(new_cost, 2)}}
        )
        await log_movement(user, p, item.quantity, "entrada", "compra", purchase_id, number)

    doc = {
        "id": purchase_id,
        "number": number,
        "company_id": user["company_id"],
        "supplier": data.supplier or "",
        "supplier_doc": data.supplier_doc or "",
        "items": lines,
        "total": round(sum(l["total"] for l in lines), 2),
        "notes": data.notes or "",
        "status": "concluida",
        "tz_offset": data.tz_offset,
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.post("/purchases/{purchase_id}/cancel")
async def cancel_purchase(purchase_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    purchase = await db.purchases.find_one({"id": purchase_id, "company_id": user["company_id"]}, {"_id": 0})
    if not purchase:
        raise HTTPException(status_code=404, detail="Compra não encontrada")
    if purchase["status"] == "cancelada":
        raise HTTPException(status_code=400, detail="Compra já cancelada")

    # Retira do estoque o que entrou; se algo já foi vendido, desfaz e bloqueia
    removed = []
    for line in purchase["items"]:
        res = await db.products.update_one(
            {"id": line["product_id"], "stock": {"$gte": line["quantity"]}},
            {"$inc": {"stock": -line["quantity"]}}
        )
        if res.modified_count == 0:
            for done in removed:
                await db.products.update_one({"id": done["product_id"]}, {"$inc": {"stock": done["quantity"]}})
            raise HTTPException(
                status_code=400,
                detail=f"Não é possível cancelar: estoque de '{line['product_name']}' já foi vendido"
            )
        removed.append(line)

    await db.purchases.update_one({"id": purchase_id}, {"$set": {"status": "cancelada", "cancelled_at": now_iso()}})
    for line in removed:
        p = {"id": line["product_id"], "name": line["product_name"]}
        await log_movement(user, p, -line["quantity"], "estorno", "compra", purchase_id, purchase["number"],
                           "Cancelamento de compra")
    return {"message": "Compra cancelada e estoque estornado"}

# ==================== VENDAS (BAIXA DE ESTOQUE) ====================

@api_router.get("/sales")
async def list_sales(user: dict = Depends(get_current_user)):
    return await db.sales.find({"company_id": user["company_id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)

@api_router.get("/sales/{sale_id}")
async def get_sale(sale_id: str, user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id, "company_id": user["company_id"]}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    return sale

@api_router.post("/sales")
async def create_sale(data: SaleCreate, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Adicione pelo menos um item")
    if data.payment_method not in PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Forma de pagamento inválida")
    seller = user
    if data.seller_id and data.seller_id != user["id"]:
        require_admin(user)
        seller = await db.users.find_one({"id": data.seller_id, "company_id": user["company_id"]}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Vendedor não encontrado")
    products = await load_products(user["company_id"], [i.product_id for i in data.items])

    # Quantidade total por produto (o mesmo produto pode aparecer em mais de uma linha)
    needed = {}
    for item in data.items:
        needed[item.product_id] = needed.get(item.product_id, 0) + item.quantity

    lines = []
    for item in data.items:
        p = products[item.product_id]
        if not p.get("active", True):
            raise HTTPException(status_code=400, detail=f"Produto '{product_label(p)}' está inativo")
        price = p.get("sale_price", 0) if item.unit_price is None else item.unit_price
        lines.append({
            "product_id": p["id"], "product_name": product_label(p), "sku": p.get("sku", ""),
            "quantity": item.quantity, "unit_price": round(price, 2),
            "unit_cost": p.get("cost_price", 0),
            "total": round(item.quantity * price, 2),
        })
    subtotal = round(sum(l["total"] for l in lines), 2)
    if data.discount > subtotal:
        raise HTTPException(status_code=400, detail="Desconto maior que o total da venda")

    # Baixa atômica: só desconta se houver saldo; se faltar algo, desfaz o que já baixou
    taken = []
    for pid, qty in needed.items():
        res = await db.products.update_one(
            {"id": pid, "company_id": user["company_id"], "stock": {"$gte": qty}},
            {"$inc": {"stock": -qty}}
        )
        if res.modified_count == 0:
            for done_pid, done_qty in taken:
                await db.products.update_one({"id": done_pid}, {"$inc": {"stock": done_qty}})
            current = await db.products.find_one({"id": pid}, {"_id": 0, "stock": 1})
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente para '{product_label(products[pid])}' "
                       f"(disponível: {(current or {}).get('stock', 0)}, pedido: {qty})"
            )
        taken.append((pid, qty))

    sale_id = str(uuid.uuid4())
    number = await next_number(user["company_id"], "sale", "FAT")
    for pid, qty in taken:
        await log_movement(user, products[pid], -qty, "saida", "venda", sale_id, number)

    total = round(subtotal - data.discount, 2)
    cost = round(sum(l["quantity"] * l["unit_cost"] for l in lines), 2)
    ctype, cvalue = sale_commission_rule(seller)
    commission = round(cvalue if ctype == "fixed" else total * cvalue / 100, 2)
    doc = {
        "id": sale_id,
        "number": number,
        "company_id": user["company_id"],
        "customer_name": data.customer_name or "",
        "customer_doc": data.customer_doc or "",
        "customer_phone": data.customer_phone or "",
        "payment_method": data.payment_method,
        "items": lines,
        "subtotal": subtotal,
        "discount": round(data.discount, 2),
        "total": total,
        "cost": cost,
        "profit": round(total - cost - commission, 2),
        "notes": data.notes or "",
        "status": "concluida",
        "tz_offset": data.tz_offset,
        "seller_id": seller["id"],
        "seller_name": seller.get("name", ""),
        "commission_type": ctype,
        "commission_rate": cvalue,
        "commission": commission,
        "created_by": user["id"],
        "created_by_name": user.get("name", ""),
        "created_at": now_iso(),
    }
    await db.sales.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.post("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: str, user: dict = Depends(get_current_user)):
    require_admin(user)
    # Troca o status de forma atômica para nunca estornar duas vezes
    result = await db.sales.update_one(
        {"id": sale_id, "company_id": user["company_id"], "status": "concluida"},
        {"$set": {"status": "cancelada", "cancelled_at": now_iso()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Venda não encontrada ou já cancelada")
    sale = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    returned = {}
    for line in sale["items"]:
        returned[line["product_id"]] = returned.get(line["product_id"], 0) + line["quantity"]
    names = {l["product_id"]: l["product_name"] for l in sale["items"]}
    for pid, qty in returned.items():
        await db.products.update_one({"id": pid}, {"$inc": {"stock": qty}})
        await log_movement(user, {"id": pid, "name": names[pid]}, qty, "estorno", "venda", sale_id,
                           sale["number"], "Cancelamento de venda")
    return {"message": "Venda cancelada e estoque devolvido"}

# ==================== FATURA EM PDF ====================

def build_invoice_pdf(sale: dict, company: dict, settings: dict) -> bytes:
    currency = settings.get("currency", "BRL")
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.6*inch, bottomMargin=0.6*inch,
                            leftMargin=0.7*inch, rightMargin=0.7*inch)
    styles = getSampleStyleSheet()
    dark = colors.HexColor('#2e1065')    # roxo escuro da marca
    muted = colors.HexColor('#64748b')
    small = ParagraphStyle('small', parent=styles['Normal'], fontSize=9, textColor=muted, leading=12)
    normal = ParagraphStyle('normal', parent=styles['Normal'], fontSize=10, leading=13)
    company_style = ParagraphStyle('company', parent=styles['Heading1'], fontSize=18, textColor=dark, spaceAfter=4)
    right_title = ParagraphStyle('rt', parent=styles['Heading1'], fontSize=20, alignment=2, textColor=dark, spaceAfter=2)
    right_small = ParagraphStyle('rs', parent=small, alignment=2)
    elements = []

    # Cabeçalho: logo + dados da loja | número da fatura
    left = []
    logo_url = company.get("logo_url") or ""
    logo_src = None
    if logo_url.startswith("data:image") and "base64," in logo_url:
        logo_src = BytesIO(base64.b64decode(logo_url.split("base64,", 1)[1]))
    elif DEFAULT_LOGO.exists():
        logo_src = str(DEFAULT_LOGO)
    if logo_src:
        try:
            img = Image(logo_src)
            ratio = img.imageWidth / float(img.imageHeight)
            img.drawHeight = 0.7*inch
            img.drawWidth = min(0.7*inch * ratio, 2*inch)
            img.hAlign = 'LEFT'
            left.append(img)
        except Exception:
            pass
    left.append(Paragraph(company.get("name", ""), company_style))
    for label, key in [("CNPJ/NIF", "tax_id"), ("", "address"), ("Tel", "phone"), ("", "email")]:
        if settings.get(key):
            left.append(Paragraph(f"{label + ': ' if label else ''}{settings[key]}", small))

    issued = to_local(sale["created_at"], sale.get("tz_offset", 0))
    right = [
        Paragraph("FATURA", right_title),
        Paragraph(f"<b>Nº {sale['number']}</b>", ParagraphStyle('n', parent=normal, alignment=2)),
        Paragraph(f"Emissão: {issued.strftime('%d/%m/%Y %H:%M')}", right_small),
    ]
    if sale.get("status") == "cancelada":
        right.append(Paragraph("<font color='#e11d48'><b>CANCELADA</b></font>",
                               ParagraphStyle('c', parent=normal, alignment=2, fontSize=14, spaceBefore=6)))
    header = Table([[left, right]], colWidths=[4.1*inch, 2.75*inch])
    header.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'),
                                ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    elements += [header, Spacer(1, 14)]

    # Cliente
    customer = [Paragraph("<b>CLIENTE</b>", small),
                Paragraph(sale.get("customer_name") or "Consumidor final", normal)]
    if sale.get("customer_doc"):
        customer.append(Paragraph(f"CPF/NIF: {sale['customer_doc']}", small))
    if sale.get("customer_phone"):
        customer.append(Paragraph(f"Tel: {sale['customer_phone']}", small))
    box = Table([[customer]], colWidths=[6.85*inch])
    box.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
                             ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                             ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 8),
                             ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    elements += [box, Spacer(1, 16)]

    # Itens
    rows = [["Produto", "Qtd", "Preço unit.", "Total"]]
    for line in sale["items"]:
        name = line["product_name"] + (f"<br/><font size=8 color='#64748b'>{line['sku']}</font>" if line.get("sku") else "")
        rows.append([Paragraph(name, normal), str(line["quantity"]),
                     money(line["unit_price"], currency), money(line["total"], currency)])
    table = Table(rows, colWidths=[3.65*inch, 0.6*inch, 1.3*inch, 1.3*inch], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), dark),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBELOW', (0, 1), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements += [table, Spacer(1, 10)]

    # Totais
    totals = [["Subtotal", money(sale["subtotal"], currency)]]
    if sale.get("discount"):
        totals.append(["Desconto", money(-sale["discount"], currency)])
    totals.append(["TOTAL", money(sale["total"], currency)])
    totals.append(["Pagamento", PAYMENT_METHODS.get(sale.get("payment_method"), sale.get("payment_method", ""))])
    t = Table(totals, colWidths=[1.5*inch, 1.6*inch], hAlign='RIGHT')
    total_row = len(totals) - 2
    t.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('FONTNAME', (0, total_row), (-1, total_row), 'Helvetica-Bold'),
        ('FONTSIZE', (0, total_row), (-1, total_row), 13),
        ('LINEABOVE', (0, total_row), (-1, total_row), 1, dark),
        ('TEXTCOLOR', (0, -1), (-1, -1), muted),
    ]))
    elements += [t, Spacer(1, 18)]

    if sale.get("notes"):
        elements += [Paragraph("<b>Observações</b>", small), Paragraph(sale["notes"], normal), Spacer(1, 12)]
    elements.append(Paragraph(f"Atendente: {sale.get('created_by_name', '')}", small))
    if settings.get("invoice_footer"):
        elements.append(Paragraph(settings["invoice_footer"], small))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph("Documento sem valor fiscal.", small))

    doc.build(elements)
    return buffer.getvalue()

@api_router.get("/sales/{sale_id}/invoice")
async def sale_invoice_pdf(sale_id: str, user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id, "company_id": user["company_id"]}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Venda não encontrada")
    company = await db.companies.find_one({"id": user["company_id"]}, {"_id": 0}) or {}
    settings = await get_store_settings(user["company_id"])
    pdf = build_invoice_pdf(sale, company, settings)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="fatura_{sale["number"]}.pdf"'},
    )

# ==================== ESTOQUE E DASHBOARD ====================

@api_router.get("/stock-movements")
async def list_movements(product_id: Optional[str] = None, limit: int = 300, user: dict = Depends(get_current_user)):
    query = {"company_id": user["company_id"]}
    if product_id:
        query["product_id"] = product_id
    return await db.stock_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 2000))

@api_router.get("/dashboard")
async def dashboard(tz_offset: int = 0, user: dict = Depends(get_current_user)):
    cid = user["company_id"]
    products = await db.products.find({"company_id": cid, "active": True}, {"_id": 0}).to_list(2000)
    now_local = datetime.now(timezone.utc) - timedelta(minutes=tz_offset)
    today = now_local.date()
    month_start = today.replace(day=1)
    # Busca ~40 dias para cobrir o mês atual e os últimos 7 dias
    since = (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
    sales = await db.sales.find({"company_id": cid, "status": "concluida", "created_at": {"$gte": since}},
                                {"_id": 0}).to_list(10000)
    purchases = await db.purchases.find({"company_id": cid, "status": "concluida", "created_at": {"$gte": since}},
                                        {"_id": 0, "total": 1, "created_at": 1}).to_list(10000)

    def local_day(iso):
        return to_local(iso, tz_offset).date()

    today_sales = [s for s in sales if local_day(s["created_at"]) == today]
    month_sales = [s for s in sales if local_day(s["created_at"]) >= month_start]
    month_purchases = [p for p in purchases if local_day(p["created_at"]) >= month_start]

    last7 = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        day_sales = [s for s in sales if local_day(s["created_at"]) == d]
        last7.append({"date": d.isoformat(), "label": d.strftime("%d/%m"),
                      "total": round(sum(s["total"] for s in day_sales), 2), "count": len(day_sales)})

    top = {}
    for s in month_sales:
        for line in s["items"]:
            t = top.setdefault(line["product_id"], {"product_name": line["product_name"], "quantity": 0, "total": 0})
            t["quantity"] += line["quantity"]
            t["total"] = round(t["total"] + line["total"], 2)

    low_stock = sorted(
        [p for p in products if p.get("stock", 0) <= p.get("min_stock", 0)],
        key=lambda p: p.get("stock", 0)
    )
    recent = await db.sales.find({"company_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(6)

    return {
        "products_count": len(products),
        "units_in_stock": sum(p.get("stock", 0) for p in products),
        "stock_value_cost": round(sum(p.get("stock", 0) * p.get("cost_price", 0) for p in products), 2),
        "stock_value_sale": round(sum(p.get("stock", 0) * p.get("sale_price", 0) for p in products), 2),
        "today_revenue": round(sum(s["total"] for s in today_sales), 2),
        "today_count": len(today_sales),
        "month_revenue": round(sum(s["total"] for s in month_sales), 2),
        "month_profit": round(sum(s.get("profit", 0) for s in month_sales), 2),
        "month_count": len(month_sales),
        "month_purchases": round(sum(p["total"] for p in month_purchases), 2),
        "last7": last7,
        "top_products": sorted(top.values(), key=lambda t: t["quantity"], reverse=True)[:5],
        "low_stock": [{"id": p["id"], "name": product_label(p), "stock": p.get("stock", 0),
                       "min_stock": p.get("min_stock", 0)} for p in low_stock],
        "stock_items": [{"id": p["id"], "name": product_label(p), "stock": p.get("stock", 0),
                         "min_stock": p.get("min_stock", 0)} for p in sorted(products, key=product_label)],
        "recent_sales": recent,
    }

# ==================== RELATÓRIOS: CURVA ABC E COMISSÕES ====================

def parse_period(start: Optional[str], end: Optional[str], tz_offset: int):
    today = (datetime.now(timezone.utc) - timedelta(minutes=tz_offset)).date()
    try:
        d_end = datetime.fromisoformat(end).date() if end else today
        d_start = datetime.fromisoformat(start).date() if start else d_end - timedelta(days=29)
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida (use AAAA-MM-DD)")
    if d_start > d_end:
        raise HTTPException(status_code=400, detail="A data inicial é maior que a final")
    return d_start, d_end

async def sales_in_period(company_id: str, d_start, d_end, tz_offset: int, extra: Optional[dict] = None) -> list:
    # Margem de 1 dia no filtro do banco; o corte exato é feito pelo dia local
    since = (datetime.combine(d_start, datetime.min.time(), tzinfo=timezone.utc) - timedelta(days=1)).isoformat()
    query = {"company_id": company_id, "status": "concluida", "created_at": {"$gte": since}, **(extra or {})}
    sales = await db.sales.find(query, {"_id": 0}).sort("created_at", 1).to_list(50000)
    return [s for s in sales if d_start <= to_local(s["created_at"], tz_offset).date() <= d_end]

@api_router.get("/reports/abc")
async def abc_report(start: Optional[str] = None, end: Optional[str] = None, tz_offset: int = 0,
                     cover_days: int = 15, user: dict = Depends(get_current_user)):
    """Curva ABC por faturamento: A = até 80% da receita, B = até 95%, C = restante"""
    require_admin(user)
    d_start, d_end = parse_period(start, end, tz_offset)
    days = (d_end - d_start).days + 1
    cover_days = max(1, min(cover_days, 365))
    sales = await sales_in_period(user["company_id"], d_start, d_end, tz_offset)

    agg = {}
    for s in sales:
        # Distribui o desconto da venda proporcionalmente entre os itens
        factor = (s["total"] / s["subtotal"]) if s.get("subtotal") else 0
        for line in s["items"]:
            a = agg.setdefault(line["product_id"], {"quantity": 0, "revenue": 0.0, "cost": 0.0, "sales": set()})
            a["quantity"] += line["quantity"]
            a["revenue"] += line["total"] * factor
            a["cost"] += line["quantity"] * line.get("unit_cost", 0)
            a["sales"].add(s["id"])

    products = await db.products.find({"company_id": user["company_id"]}, {"_id": 0}).to_list(5000)
    rows = []
    for p in products:
        a = agg.get(p["id"])
        if not a and not p.get("active", True):
            continue
        a = a or {"quantity": 0, "revenue": 0.0, "cost": 0.0, "sales": set()}
        rows.append({
            "product_id": p["id"], "name": product_label(p), "sku": p.get("sku", ""),
            "quantity": a["quantity"], "revenue": round(a["revenue"], 2),
            "profit": round(a["revenue"] - a["cost"], 2), "sales_count": len(a["sales"]),
            "stock": p.get("stock", 0), "min_stock": p.get("min_stock", 0),
        })

    rows.sort(key=lambda r: (r["revenue"], r["quantity"]), reverse=True)
    total_revenue = sum(r["revenue"] for r in rows)
    cumulative = 0.0
    for r in rows:
        share = (r["revenue"] / total_revenue * 100) if total_revenue else 0
        before = cumulative
        cumulative += share
        r["share"] = round(share, 2)
        r["cumulative"] = round(cumulative, 2)
        r["abc"] = "C" if r["revenue"] <= 0 else ("A" if before < 80 else "B" if before < 95 else "C")
        avg_daily = r["quantity"] / days
        r["avg_daily"] = round(avg_daily, 2)
        r["coverage_days"] = round(r["stock"] / avg_daily, 1) if avg_daily else None
        # Sugestão: estoque para `cover_days` dias de venda, nunca abaixo do mínimo
        target = max(math.ceil(avg_daily * cover_days), r["min_stock"])
        r["suggested_purchase"] = max(0, target - r["stock"])

    summary = {}
    for cls in ("A", "B", "C"):
        items = [r for r in rows if r["abc"] == cls]
        rev = sum(r["revenue"] for r in items)
        summary[cls] = {"count": len(items), "revenue": round(rev, 2),
                        "share": round(rev / total_revenue * 100, 2) if total_revenue else 0}

    return {
        "start": d_start.isoformat(), "end": d_end.isoformat(), "days": days, "cover_days": cover_days,
        "sales_count": len(sales), "total_revenue": round(total_revenue, 2),
        "summary": summary, "rows": rows,
    }

@api_router.get("/reports/commissions")
async def commissions_report(start: Optional[str] = None, end: Optional[str] = None, tz_offset: int = 0,
                             user: dict = Depends(get_current_user)):
    """Comissões por vendedor; quem não é admin vê só as próprias"""
    d_start, d_end = parse_period(start, end, tz_offset)
    is_admin = user.get("role") == "admin"
    sales = await sales_in_period(user["company_id"], d_start, d_end, tz_offset)
    if not is_admin:
        sales = [s for s in sales if s.get("seller_id", s.get("created_by")) == user["id"]]

    users = await db.users.find({"company_id": user["company_id"]}, {"_id": 0, "password": 0}).to_list(1000)
    if not is_admin:
        users = [u for u in users if u["id"] == user["id"]]
    sellers = {}
    for u in users:
        ctype, cvalue = sale_commission_rule(u)
        sellers[u["id"]] = {"seller_id": u["id"], "seller_name": u["name"], "commission_type": ctype,
                            "commission_value": cvalue, "sales_count": 0, "total_sold": 0.0, "commission": 0.0}
    for s in sales:
        sid = s.get("seller_id", s.get("created_by"))
        row = sellers.setdefault(sid, {"seller_id": sid, "seller_name": s.get("seller_name") or s.get("created_by_name", ""),
                                       "commission_type": "", "commission_value": 0, "sales_count": 0,
                                       "total_sold": 0.0, "commission": 0.0})
        row["sales_count"] += 1
        row["total_sold"] += s["total"]
        row["commission"] += s.get("commission", 0)

    rows = sorted(sellers.values(), key=lambda r: r["commission"], reverse=True)
    for r in rows:
        r["total_sold"] = round(r["total_sold"], 2)
        r["commission"] = round(r["commission"], 2)
    return {
        "start": d_start.isoformat(), "end": d_end.isoformat(),
        "total_commission": round(sum(r["commission"] for r in rows), 2),
        "rows": rows,
        "sales": [{"id": s["id"], "number": s["number"], "created_at": s["created_at"],
                   "seller_name": s.get("seller_name") or s.get("created_by_name", ""),
                   "total": s["total"], "commission": s.get("commission", 0)} for s in reversed(sales)],
    }

# ==================== CONFIGURAÇÕES DA LOJA ====================

@api_router.get("/settings")
async def read_settings(user: dict = Depends(get_current_user)):
    return await get_store_settings(user["company_id"])

@api_router.put("/settings")
async def save_settings(data: StoreSettings, user: dict = Depends(get_current_user)):
    require_admin(user)
    if data.currency not in CURRENCIES:
        raise HTTPException(status_code=400, detail="Moeda inválida")
    await db.settings.update_one(
        {"company_id": user["company_id"]},
        {"$set": {**data.model_dump(), "company_id": user["company_id"]}},
        upsert=True
    )
    return await get_store_settings(user["company_id"])

@api_router.get("/")
async def root():
    return {"message": "Vape Store API", "version": "3.0.0"}

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
