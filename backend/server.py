from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
from io import BytesIO
import base64
import resend

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

# Resend Config
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

# Create the main app
app = FastAPI(title="Lacucina API", version="1.0.0")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class UnitCreate(BaseModel):
    name: str
    address: Optional[str] = ""

class UnitResponse(BaseModel):
    id: str
    name: str
    address: str
    created_at: str

class SectionCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "Package"

class SectionResponse(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    created_at: str

class ItemCreate(BaseModel):
    name: str
    section_id: str
    unit_of_measure: str  # kg, un, cx, l
    minimum_stock: float = 0
    average_consumption: float = 0

class ItemResponse(BaseModel):
    id: str
    name: str
    section_id: str
    section_name: Optional[str] = ""
    unit_of_measure: str
    minimum_stock: float
    average_consumption: float
    created_at: str

class SafetyStockCreate(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    percentage: float = 0
    enabled: bool = True

class SafetyStockResponse(BaseModel):
    id: str
    unit_id: str
    day_of_week: int
    percentage: float
    enabled: bool

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

class OrderItemCreate(BaseModel):
    item_id: str
    item_name: str
    section_id: str
    section_name: str
    unit_of_measure: str
    calculated_quantity: float
    adjusted_quantity: float

class OrderCreate(BaseModel):
    unit_id: str
    target_date: str
    items: List[OrderItemCreate]
    notes: Optional[str] = ""

class OrderResponse(BaseModel):
    id: str
    unit_id: str
    unit_name: Optional[str] = ""
    target_date: str
    items: List[dict]
    status: str  # pending, completed, cancelled
    notes: str
    created_at: str
    completed_at: Optional[str] = None

class EmailRequest(BaseModel):
    order_id: str
    recipients: List[EmailStr]

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
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

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=dict)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "email": user.email,
        "password": hash_password(user.password),
        "name": user.name,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_doc["id"], user_doc["email"])
    return {
        "token": token,
        "user": {"id": user_doc["id"], "email": user_doc["email"], "name": user_doc["name"]}
    }

@api_router.post("/auth/login", response_model=dict)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user["name"]}
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )

# ==================== UNITS ROUTES ====================

@api_router.get("/units", response_model=List[UnitResponse])
async def get_units(user: dict = Depends(get_current_user)):
    units = await db.units.find({}, {"_id": 0}).to_list(100)
    return [UnitResponse(**u) for u in units]

@api_router.post("/units", response_model=UnitResponse)
async def create_unit(unit: UnitCreate, user: dict = Depends(get_current_user)):
    unit_doc = {
        "id": str(uuid.uuid4()),
        "name": unit.name,
        "address": unit.address,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.units.insert_one(unit_doc)
    return UnitResponse(**unit_doc)

@api_router.put("/units/{unit_id}", response_model=UnitResponse)
async def update_unit(unit_id: str, unit: UnitCreate, user: dict = Depends(get_current_user)):
    result = await db.units.update_one(
        {"id": unit_id},
        {"$set": {"name": unit.name, "address": unit.address}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    updated = await db.units.find_one({"id": unit_id}, {"_id": 0})
    return UnitResponse(**updated)

@api_router.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(get_current_user)):
    result = await db.units.delete_one({"id": unit_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Unit not found")
    return {"message": "Unit deleted"}

# ==================== SECTIONS ROUTES ====================

@api_router.get("/sections", response_model=List[SectionResponse])
async def get_sections(user: dict = Depends(get_current_user)):
    sections = await db.sections.find({}, {"_id": 0}).to_list(100)
    return [SectionResponse(**s) for s in sections]

@api_router.post("/sections", response_model=SectionResponse)
async def create_section(section: SectionCreate, user: dict = Depends(get_current_user)):
    section_doc = {
        "id": str(uuid.uuid4()),
        "name": section.name,
        "description": section.description,
        "icon": section.icon,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.sections.insert_one(section_doc)
    return SectionResponse(**section_doc)

@api_router.put("/sections/{section_id}", response_model=SectionResponse)
async def update_section(section_id: str, section: SectionCreate, user: dict = Depends(get_current_user)):
    result = await db.sections.update_one(
        {"id": section_id},
        {"$set": {"name": section.name, "description": section.description, "icon": section.icon}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    updated = await db.sections.find_one({"id": section_id}, {"_id": 0})
    return SectionResponse(**updated)

@api_router.delete("/sections/{section_id}")
async def delete_section(section_id: str, user: dict = Depends(get_current_user)):
    result = await db.sections.delete_one({"id": section_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Section not found")
    return {"message": "Section deleted"}

# ==================== ITEMS ROUTES ====================

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(user: dict = Depends(get_current_user)):
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({}, {"_id": 0}).to_list(100)}
    result = []
    for item in items:
        item["section_name"] = sections.get(item.get("section_id", ""), "")
        result.append(ItemResponse(**item))
    return result

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, user: dict = Depends(get_current_user)):
    section = await db.sections.find_one({"id": item.section_id}, {"_id": 0})
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    
    item_doc = {
        "id": str(uuid.uuid4()),
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
        {"id": item_id},
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
    result = await db.items.delete_one({"id": item_id})
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
                "percentage": 20 if day in [4, 5] else 10,  # Friday, Saturday higher
                "enabled": True
            }
            await db.safety_stock.insert_one(config)
        configs = await db.safety_stock.find({"unit_id": unit_id}, {"_id": 0}).to_list(7)
    
    return [SafetyStockResponse(**c) for c in configs]

@api_router.put("/safety-stock/{unit_id}")
async def update_safety_stock(unit_id: str, configs: List[SafetyStockCreate], user: dict = Depends(get_current_user)):
    for config in configs:
        await db.safety_stock.update_one(
            {"unit_id": unit_id, "day_of_week": config.day_of_week},
            {"$set": {"percentage": config.percentage, "enabled": config.enabled}},
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
    items = {i["id"]: i["name"] for i in await db.items.find({}, {"_id": 0}).to_list(1000)}
    
    result = []
    for entry in entries:
        entry["item_name"] = items.get(entry.get("item_id", ""), "")
        result.append(StockEntryResponse(**entry))
    return result

@api_router.get("/stock-entries/{unit_id}/latest", response_model=List[StockEntryResponse])
async def get_latest_stock_entries(unit_id: str, user: dict = Depends(get_current_user)):
    """Get the most recent stock entry for each item in a unit"""
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
    items = {i["id"]: i["name"] for i in await db.items.find({}, {"_id": 0}).to_list(1000)}
    
    result = []
    for entry in entries:
        entry["item_name"] = items.get(entry.get("item_id", ""), "")
        result.append(StockEntryResponse(**entry))
    return result

@api_router.post("/stock-entries", response_model=List[StockEntryResponse])
async def create_stock_entries(entries: List[StockEntryCreate], user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    results = []
    items = {i["id"]: i["name"] for i in await db.items.find({}, {"_id": 0}).to_list(1000)}
    
    for entry in entries:
        # Check for duplicate entry today
        existing = await db.stock_entries.find_one({
            "item_id": entry.item_id,
            "unit_id": entry.unit_id,
            "entry_date": today
        }, {"_id": 0})
        
        if existing:
            # Update existing entry
            await db.stock_entries.update_one(
                {"id": existing["id"]},
                {"$set": {"quantity": entry.quantity}}
            )
            existing["quantity"] = entry.quantity
            existing["item_name"] = items.get(entry.item_id, "")
            results.append(StockEntryResponse(**existing))
        else:
            # Create new entry
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
    
    # Update average consumption for items
    await update_average_consumption()
    
    return results

async def update_average_consumption():
    """Update average consumption based on stock entries (last 7 days)"""
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
            # Calculate consumption as difference between consecutive days
            total_consumption = 0
            for i in range(1, len(entries)):
                diff = entries[i-1]["quantity"] - entries[i]["quantity"]
                if diff > 0:
                    total_consumption += diff
            avg_consumption = total_consumption / (len(entries) - 1) if len(entries) > 1 else 0
            
            await db.items.update_one(
                {"id": result["_id"]["item_id"]},
                {"$set": {"average_consumption": round(avg_consumption, 2)}}
            )

# ==================== ORDERS ROUTES ====================

@api_router.get("/orders/{unit_id}", response_model=List[OrderResponse])
async def get_orders(unit_id: str, status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"unit_id": unit_id}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    units = {u["id"]: u["name"] for u in await db.units.find({}, {"_id": 0}).to_list(100)}
    
    result = []
    for order in orders:
        order["unit_name"] = units.get(order.get("unit_id", ""), "")
        result.append(OrderResponse(**order))
    return result

@api_router.get("/orders/{unit_id}/calculate")
async def calculate_order(unit_id: str, target_date: str, user: dict = Depends(get_current_user)):
    """Calculate order needs for a target date"""
    target = datetime.strptime(target_date, "%Y-%m-%d")
    day_of_week = target.weekday()
    
    # Get safety stock config for target day
    safety_config = await db.safety_stock.find_one(
        {"unit_id": unit_id, "day_of_week": day_of_week},
        {"_id": 0}
    )
    safety_percentage = safety_config["percentage"] if safety_config and safety_config.get("enabled") else 0
    
    # Get all items with sections
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({}, {"_id": 0}).to_list(100)}
    
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
        avg_consumption = item.get("average_consumption", 0)
        safety_amount = avg_consumption * (safety_percentage / 100)
        
        # Calculation: (Safety Stock + Average Consumption) - Current Stock
        needed = (safety_amount + avg_consumption) - current_stock
        
        if needed > 0:
            order_items.append({
                "item_id": item["id"],
                "item_name": item["name"],
                "section_id": item["section_id"],
                "section_name": sections.get(item["section_id"], ""),
                "unit_of_measure": item["unit_of_measure"],
                "current_stock": current_stock,
                "average_consumption": avg_consumption,
                "safety_percentage": safety_percentage,
                "calculated_quantity": round(needed, 2),
                "adjusted_quantity": round(needed, 2)
            })
    
    # Sort by section
    order_items.sort(key=lambda x: x["section_name"])
    
    return {
        "target_date": target_date,
        "safety_percentage": safety_percentage,
        "items": order_items
    }

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": order.unit_id}, {"_id": 0})
    
    order_doc = {
        "id": str(uuid.uuid4()),
        "unit_id": order.unit_id,
        "target_date": order.target_date,
        "items": [item.model_dump() for item in order.items],
        "status": "pending",
        "notes": order.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None
    }
    await db.orders.insert_one(order_doc)
    order_doc["unit_name"] = unit["name"] if unit else ""
    return OrderResponse(**order_doc)

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, status: str, user: dict = Depends(get_current_user)):
    update_data = {"status": status}
    if status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": f"Order status updated to {status}"}

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, user: dict = Depends(get_current_user)):
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Order deleted"}

# ==================== PDF GENERATION ====================

@api_router.get("/orders/{order_id}/pdf")
async def generate_order_pdf(order_id: str, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    unit = await db.units.find_one({"id": order["unit_id"]}, {"_id": 0})
    unit_name = unit["name"] if unit else "Unknown"
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=20, spaceAfter=20, textColor=colors.HexColor('#0f172a'))
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=12, spaceAfter=10, textColor=colors.HexColor('#64748b'))
    
    elements = []
    
    # Header
    elements.append(Paragraph("LACUCINA", title_style))
    elements.append(Paragraph(f"Purchase Order - {unit_name}", subtitle_style))
    elements.append(Paragraph(f"Date: {order['target_date']}", subtitle_style))
    elements.append(Paragraph(f"Order ID: {order['id'][:8]}", subtitle_style))
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
        elements.append(Paragraph(section_name, styles['Heading2']))
        elements.append(Spacer(1, 10))
        
        table_data = [["Item", "Quantity", "Unit"]]
        for item in items:
            table_data.append([
                item["item_name"],
                str(item["adjusted_quantity"]),
                item["unit_of_measure"]
            ])
        
        table = Table(table_data, colWidths=[4*inch, 1.5*inch, 1*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e2e8f0')),
            ('FONTSIZE', (0, 1), (-1, -1), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 20))
    
    # Notes
    if order.get("notes"):
        elements.append(Paragraph("Notes:", styles['Heading3']))
        elements.append(Paragraph(order["notes"], styles['Normal']))
    
    # Footer
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}", subtitle_style))
    
    doc.build(elements)
    
    pdf_data = buffer.getvalue()
    buffer.close()
    
    return {
        "pdf_base64": base64.b64encode(pdf_data).decode(),
        "filename": f"order_{order['id'][:8]}_{order['target_date']}.pdf"
    }

# ==================== EMAIL ====================

@api_router.post("/orders/{order_id}/email")
async def send_order_email(order_id: str, request: EmailRequest, user: dict = Depends(get_current_user)):
    if not RESEND_API_KEY:
        raise HTTPException(status_code=400, detail="Email service not configured")
    
    # Get order PDF
    pdf_response = await generate_order_pdf(order_id, user)
    pdf_data = base64.b64decode(pdf_response["pdf_base64"])
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    unit = await db.units.find_one({"id": order["unit_id"]}, {"_id": 0})
    unit_name = unit["name"] if unit else "Unknown"
    
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #0f172a;">Lacucina Purchase Order</h1>
        <p><strong>Unit:</strong> {unit_name}</p>
        <p><strong>Date:</strong> {order['target_date']}</p>
        <p><strong>Items:</strong> {len(order['items'])} items</p>
        <p>Please find the detailed purchase order attached as PDF.</p>
        <hr style="margin-top: 30px;">
        <p style="color: #64748b; font-size: 12px;">
            This email was generated automatically by Lacucina Kitchen Management System.
        </p>
    </body>
    </html>
    """
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": request.recipients,
            "subject": f"Purchase Order - {unit_name} - {order['target_date']}",
            "html": html_content,
            "attachments": [{
                "filename": pdf_response["filename"],
                "content": pdf_response["pdf_base64"]
            }]
        }
        
        email_result = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "success", "message": f"Email sent to {len(request.recipients)} recipients"}
    except Exception as e:
        logger.error(f"Email error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

# ==================== REPORTS ====================

@api_router.get("/reports/dashboard/{unit_id}")
async def get_dashboard_stats(unit_id: str, user: dict = Depends(get_current_user)):
    # Total items
    total_items = await db.items.count_documents({})
    
    # Get latest stock entries
    pipeline = [
        {"$match": {"unit_id": unit_id}},
        {"$sort": {"entry_date": -1}},
        {"$group": {
            "_id": "$item_id",
            "quantity": {"$first": "$quantity"}
        }}
    ]
    latest_entries = {e["_id"]: e["quantity"] for e in await db.stock_entries.aggregate(pipeline).to_list(1000)}
    
    # Items with low stock
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
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
    
    # Pending orders
    pending_orders = await db.orders.count_documents({"unit_id": unit_id, "status": "pending"})
    completed_orders = await db.orders.count_documents({"unit_id": unit_id, "status": "completed"})
    
    # Sections count
    sections_count = await db.sections.count_documents({})
    
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
    items = await db.items.find({}, {"_id": 0}).to_list(1000)
    sections = {s["id"]: s["name"] for s in await db.sections.find({}, {"_id": 0}).to_list(100)}
    
    # Get latest stock entries
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

@api_router.get("/reports/consumption/{unit_id}")
async def get_consumption_report(unit_id: str, days: int = 30, user: dict = Depends(get_current_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    entries = await db.stock_entries.find(
        {"unit_id": unit_id, "entry_date": {"$gte": start_date}},
        {"_id": 0}
    ).sort("entry_date", 1).to_list(10000)
    
    items = {i["id"]: i for i in await db.items.find({}, {"_id": 0}).to_list(1000)}
    sections = {s["id"]: s["name"] for s in await db.sections.find({}, {"_id": 0}).to_list(100)}
    
    # Group entries by item
    item_entries = {}
    for entry in entries:
        item_id = entry["item_id"]
        if item_id not in item_entries:
            item_entries[item_id] = []
        item_entries[item_id].append(entry)
    
    # Calculate consumption per item
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

@api_router.get("/reports/orders-history/{unit_id}")
async def get_orders_history(
    unit_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"unit_id": unit_id}
    if start_date:
        query["target_date"] = {"$gte": start_date}
    if end_date:
        if "target_date" in query:
            query["target_date"]["$lte"] = end_date
        else:
            query["target_date"] = {"$lte": end_date}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("target_date", -1).to_list(1000)
    
    # Summary
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

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data(user: dict = Depends(get_current_user)):
    """Seed initial data for demo purposes"""
    
    # Check if data already exists
    existing_sections = await db.sections.count_documents({})
    if existing_sections > 0:
        return {"message": "Data already seeded"}
    
    # Create default sections
    sections = [
        {"id": str(uuid.uuid4()), "name": "Freezer", "description": "Frozen products", "icon": "Snowflake", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Meats", "description": "Fresh meats and proteins", "icon": "Beef", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Produce", "description": "Fresh fruits and vegetables", "icon": "Carrot", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Grocery", "description": "Dry goods and pantry items", "icon": "ShoppingBasket", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Dairy", "description": "Milk, cheese, and dairy products", "icon": "Milk", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.sections.insert_many(sections)
    
    # Create sample items
    items = [
        # Freezer
        {"id": str(uuid.uuid4()), "name": "Frozen Shrimp", "section_id": sections[0]["id"], "unit_of_measure": "kg", "minimum_stock": 5, "average_consumption": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Ice Cream", "section_id": sections[0]["id"], "unit_of_measure": "l", "minimum_stock": 10, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        # Meats
        {"id": str(uuid.uuid4()), "name": "Chicken Breast", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Ground Beef", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 8, "average_consumption": 4, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Pork Loin", "section_id": sections[1]["id"], "unit_of_measure": "kg", "minimum_stock": 6, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        # Produce
        {"id": str(uuid.uuid4()), "name": "Tomatoes", "section_id": sections[2]["id"], "unit_of_measure": "kg", "minimum_stock": 15, "average_consumption": 8, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Lettuce", "section_id": sections[2]["id"], "unit_of_measure": "un", "minimum_stock": 20, "average_consumption": 10, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Onions", "section_id": sections[2]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        # Grocery
        {"id": str(uuid.uuid4()), "name": "Olive Oil", "section_id": sections[3]["id"], "unit_of_measure": "l", "minimum_stock": 5, "average_consumption": 1, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Pasta", "section_id": sections[3]["id"], "unit_of_measure": "kg", "minimum_stock": 10, "average_consumption": 3, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Rice", "section_id": sections[3]["id"], "unit_of_measure": "kg", "minimum_stock": 15, "average_consumption": 5, "created_at": datetime.now(timezone.utc).isoformat()},
        # Dairy
        {"id": str(uuid.uuid4()), "name": "Milk", "section_id": sections[4]["id"], "unit_of_measure": "l", "minimum_stock": 20, "average_consumption": 10, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Butter", "section_id": sections[4]["id"], "unit_of_measure": "kg", "minimum_stock": 5, "average_consumption": 2, "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "name": "Parmesan Cheese", "section_id": sections[4]["id"], "unit_of_measure": "kg", "minimum_stock": 3, "average_consumption": 1, "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.items.insert_many(items)
    
    return {"message": "Data seeded successfully", "sections": len(sections), "items": len(items)}

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Lacucina API", "version": "1.0.0"}

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
