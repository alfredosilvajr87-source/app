# Kitchen Inventory Management System - V2

## Original Problem Statement
Professional kitchen inventory management for multiple companies/units with:
- Multi-company/multi-tenant architecture (like ERP systems)
- User roles: Admin (full access), User (view-only for settings)
- Customizable company logo and name
- Unit management with initials for order numbering
- Food sections and items with minimum stock
- Safety stock: quantity INCREMENT by day (not percentage)
- Daily stock entry with consumption tracking
- Order generation with calculation and amendment support
- PDF export with sharing (Web Share API for mobile)
- Reports with PDF generation

## User Personas
1. **Company Admin** - Full access, manages users, units, settings, company branding
2. **Kitchen Manager** - Views settings, manages inventory, creates orders
3. **Staff** - Enters daily stock counts, views stock levels

## Core Requirements (Static)
- [x] Multi-tenant architecture with companies
- [x] JWT Authentication (email/password)
- [x] User roles (admin/user) with permission control
- [x] Company customization (logo upload, name)
- [x] Unit management with initials for order numbering
- [x] Sections CRUD (Freezer, Meats, Produce, Grocery, Dairy)
- [x] Items CRUD with section, unit of measure, minimum stock
- [x] Safety stock: quantity increment per day (not percentage)
- [x] Daily stock entry with duplicate prevention
- [x] Order calculation: (Min Stock + Day Increment + Avg Consumption) - Current Stock
- [x] Order ID format: INITIALS-YEAR-SEQUENCE (e.g., MK-2026-001)
- [x] Order quantities as integers (no decimals)
- [x] Amendment orders for completed orders
- [x] PDF generation for orders and all reports
- [x] Share functionality via Web Share API
- [x] Password change for users
- [x] Reports: Dashboard KPIs, Stock Status, Consumption, Orders History
- [x] Responsive UI for tablets, phones, and desktop

## What's Been Implemented (Mar 2026)

### Backend V2 (FastAPI + MongoDB)
- Multi-tenant company system with logo upload
- User management with admin/user roles
- Units with initials for order numbering
- Sections and Items with company isolation
- Safety Stock with quantity increments per day
- Stock Entries with consumption tracking
- Orders with custom numbering (MK-2026-001)
- Amendment orders for completed orders
- PDF generation with user info and timestamps
- Reports with PDF export endpoints
- **V3 Item Features (Mar 2026):**
  - Minimum stock per day of week (minimum_stock_by_day)
  - Item visibility per unit (visible_in_units)
  - New units of measure: bottle, bucket, can, bag, pack
  - Duplicate item prevention (same name + section + unit)
  - Password reset flow (forgot password)

### Frontend V2 (React)
- New login with company creation for first user
- Company branding in header (logo + name)
- Admin-only controls throughout UI
- Settings with company, units, safety stock config
- User management page (admin only)
- Password change dialog
- Share buttons using Web Share API
- PDF download for all reports
- Order amendments for completed orders
- Integer-only quantity inputs
- **V3 Item UI (Mar 2026):**
  - 3-tab item form: Basic Info, Min Stock, Visibility
  - Daily minimum toggle with 7-day inputs (Mon-Sun)
  - Unit visibility checkboxes
  - 17 units of measure in dropdown
  - Forgot password modal on login page

## Prioritized Backlog

### P0 - Critical (None remaining)
All P0 features implemented - V3 Item Features Complete

### P1 - High Priority
- [ ] Batch import/export of items (CSV)
- [ ] Low stock notifications/push alerts
- [ ] Multi-language support (PT-BR, EN)

### P2 - Medium Priority  
- [ ] Supplier management
- [ ] Purchase price tracking
- [ ] Historical price charts
- [ ] PWA for offline support
- [ ] Verify order amendment logic (modify completed order generates delta only)

### P3 - Future Enhancements
- [ ] Barcode/QR scanning
- [ ] AI-powered demand forecasting
- [ ] Accounting system integration
- [ ] Recipe/menu integration

## Testing Summary (Mar 2026)
- Backend: 21/21 tests passed (100%)
- Frontend: All V3 features working correctly (100%)
- Test credentials: uitest@test.com / TestPass123!

## Next Tasks
1. Create production units with proper initials
2. Import real item catalog with daily minimums configured
3. Train staff on daily entry workflow
4. Configure safety stock increments for each day
