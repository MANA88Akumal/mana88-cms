# MANA88 CMS Migration Plan
## Google Apps Script → React + Supabase (PostgreSQL)

**Target Domain:** cms.manaakumal.com  
**Server:** AWS Lightsail (44.241.184.228) - Shared with cash.manaakumal.com & investors.manaakumal.com  
**Deploy Path:** /opt/bitnami/apache/htdocs/cms/

---

## 1. Current System Architecture

### Data Sources (Google Sheets)
| Sheet | Purpose | Record Count |
|-------|---------|--------------|
| MANA88_Cases | Master case data with DTO JSON | ~65 cases |
| All Payments | Payment transactions | ~185 payments |
| Amortization | Financial calculations | Derived |
| CaseIndex | Summary view | Derived |
| Units | Property inventory | ~100+ lots |

### Key Business Entities
```
Case (DTO JSON Structure)
├── caseId: "MANA88-AK-0001"
├── buyers: { b1, b2, idUrl }
├── contacts: { email1, email2, phone1, phone2 }
├── property: { lot, manzana, m2 }
├── pricing: { list, sale }
├── plan: { name, downPct, downMx }
├── broker: { name, agency, email, phone }
├── scheduleRaw: [{ type, label, amount, date }]
└── contract: { buyerAddress, buyerIdUrl }

Payment
├── caseId, timestamp, buyerName
├── manzana, lot, paymentDate
├── amountPaid (MXN), currency
├── paymentType (DOWN PAYMENT, LOAN PAYMENT, etc.)
├── proofUrls (MANA_Proof_URL, Client_Proof_URL)
├── channel, reference, source
└── auditId
```

### Current UI Routes (Google Apps Script)
| Route | View | Purpose |
|-------|------|---------|
| `?view=` | Landing.html | Home/dashboard |
| `?view=create` | index.html | Offer letter form |
| `?view=case` | CaseStatus.html | Individual case view |
| `?view=queue` | ApprovalQueue.html | Pending approvals |
| `?view=clients` | ClientConsole.html | Payment management |
| `?view=finance` | FinanceReport.html | Financial reporting |
| `?view=intake` | ManualIntake.html | Manual case entry |

---

## 2. Target Architecture

### Stack
- **Frontend:** React 18 + TypeScript + Vite
- **UI Framework:** Tailwind CSS + shadcn/ui
- **State Management:** TanStack Query (React Query)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth (Google OAuth for staff)
- **Storage:** Supabase Storage (replaces Google Drive)
- **Deployment:** AWS Lightsail (static + API via Supabase)

### URL Structure
```
cms.manaakumal.com/                    → Dashboard
cms.manaakumal.com/cases               → Cases list
cms.manaakumal.com/cases/:id           → Case detail
cms.manaakumal.com/cases/new           → New case form
cms.manaakumal.com/payments            → Payment console
cms.manaakumal.com/payments/:caseId    → Case payments
cms.manaakumal.com/approvals           → Approval queue
cms.manaakumal.com/finance             → Finance reports
cms.manaakumal.com/intake              → Manual intake
```

---

## 3. Database Schema (Supabase/PostgreSQL)

### Core Tables

```sql
-- Properties/Units (inventory)
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manzana VARCHAR(10) NOT NULL,           -- C4, C6, etc.
  lot VARCHAR(10) NOT NULL,
  surface_m2 DECIMAL(10,2),
  list_price_mxn DECIMAL(12,2),
  status VARCHAR(50) DEFAULT 'available', -- available, reserved, sold
  folder_path TEXT,                        -- Supabase storage path
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manzana, lot)
);

-- Clients/Buyers
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  full_name_secondary VARCHAR(255),       -- Co-buyer
  email_primary VARCHAR(255),
  email_secondary VARCHAR(255),
  phone_primary VARCHAR(50),
  phone_secondary VARCHAR(50),
  address TEXT,
  nationality VARCHAR(100),
  id_document_url TEXT,                   -- Storage path
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Cases (master record)
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(50) UNIQUE NOT NULL,    -- MANA88-AK-0001
  unit_id UUID REFERENCES units(id),
  client_id UUID REFERENCES clients(id),
  
  -- Pricing
  list_price_mxn DECIMAL(12,2),
  sale_price_mxn DECIMAL(12,2) NOT NULL,
  
  -- Payment Plan
  plan_name VARCHAR(100),                 -- 30/60/10, 90/10, Custom
  down_payment_pct DECIMAL(5,2),
  down_payment_mxn DECIMAL(12,2),
  
  -- Broker
  broker_name VARCHAR(255),
  broker_agency VARCHAR(255),
  broker_email VARCHAR(255),
  broker_phone VARCHAR(50),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',   -- pending, active, contract_generated, executed, cancelled
  
  -- Document URLs
  offer_doc_url TEXT,
  offer_pdf_url TEXT,
  folder_url TEXT,
  
  -- Schedule (JSONB for flexibility)
  schedule_raw JSONB,                     -- Array of payment schedule items
  
  -- Metadata
  notes TEXT,
  dto_json JSONB,                         -- Full legacy DTO for migration
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments/Transactions
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) NOT NULL,
  
  -- Payment details
  payment_date DATE NOT NULL,
  payment_month VARCHAR(7),               -- 2025-03
  amount_mxn DECIMAL(12,2) NOT NULL,      -- Precise to centavo
  currency VARCHAR(10) DEFAULT 'MXN',
  
  -- Classification
  payment_type VARCHAR(50),               -- DOWN_PAYMENT, MONTHLY, FINAL
  applied_to_installment INTEGER,
  
  -- Proof documents
  mana_proof_url TEXT,
  client_proof_url TEXT,
  
  -- Tracking
  channel VARCHAR(50),                    -- wire, cash, check
  reference_number VARCHAR(100),
  entered_by VARCHAR(255),
  source VARCHAR(50),                     -- client-console, legacy-import
  
  -- Notes
  notes TEXT,
  
  -- Audit
  audit_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Schedule (expected payments)
CREATE TABLE payment_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) NOT NULL,
  
  schedule_index INTEGER NOT NULL,        -- 0, 1, 2...
  payment_type VARCHAR(50) NOT NULL,      -- reserva, enganche, mensualidad, entrega
  label VARCHAR(255),
  amount_mxn DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',   -- pending, paid, partial, overdue
  paid_amount_mxn DECIMAL(12,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(case_id, schedule_index)
);

-- Approvals Queue
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) NOT NULL,
  
  request_type VARCHAR(50),               -- new_case, amendment, cancellation
  requested_by VARCHAR(255),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  
  status VARCHAR(50) DEFAULT 'pending',   -- pending, approved, rejected
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ DEFAULT NOW(),
  actor VARCHAR(255),
  action VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id UUID,
  data_json JSONB,
  ip_address VARCHAR(50)
);

-- Staff/Users
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'viewer',      -- admin, finance, legal, broker, viewer
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes for Performance
```sql
CREATE INDEX idx_cases_case_id ON cases(case_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_unit_id ON cases(unit_id);
CREATE INDEX idx_payments_case_id ON payments(case_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_schedule_case_id ON payment_schedule(case_id);
CREATE INDEX idx_schedule_due_date ON payment_schedule(due_date);
CREATE INDEX idx_units_manzana_lot ON units(manzana, lot);
```

### Row Level Security (RLS)
```sql
-- Enable RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can read all
CREATE POLICY "Staff can view all cases" ON cases
  FOR SELECT USING (
    auth.jwt() ->> 'email' IN (SELECT email FROM staff WHERE is_active = true)
  );

-- Policy: Only admin/finance can modify
CREATE POLICY "Admin/Finance can modify cases" ON cases
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT email FROM staff WHERE is_active = true AND role IN ('admin', 'finance')
    )
  );
```

---

## 4. API Design (Supabase Edge Functions / Direct Client)

### Case APIs
```typescript
// List cases with filters
GET  /cases?status=active&manzana=C6&page=1

// Get single case with payments
GET  /cases/:id

// Create new case
POST /cases
Body: { unit_id, client, pricing, plan, broker, schedule }

// Update case
PATCH /cases/:id
Body: { status, schedule_raw, notes }
```

### Payment APIs
```typescript
// List payments for case
GET  /payments?case_id=xxx

// Record new payment
POST /payments
Body: { case_id, payment_date, amount_mxn, payment_type, proof_urls }

// Get payment summary (calculated)
GET  /cases/:id/summary
Response: { total_due, total_paid, balance, next_due_date, overdue_amount }
```

### Finance APIs
```typescript
// Finance report (aggregated)
GET  /reports/finance?from=2025-01&to=2025-12

// Export to CSV
GET  /reports/finance/export?format=csv
```

---

## 5. React Component Structure

```
src/
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/
│   │   ├── AppHeader.tsx       # Navigation header
│   │   ├── Sidebar.tsx         # Main navigation
│   │   └── PageWrapper.tsx     # Common page layout
│   ├── cases/
│   │   ├── CaseCard.tsx        # Case summary card
│   │   ├── CaseTable.tsx       # Cases list table
│   │   ├── CaseForm.tsx        # Create/edit case form
│   │   ├── CaseStatus.tsx      # Status badge/display
│   │   └── PaymentSchedule.tsx # Schedule timeline
│   ├── payments/
│   │   ├── PaymentForm.tsx     # Record payment modal
│   │   ├── PaymentTable.tsx    # Payments history
│   │   ├── PaymentSummary.tsx  # Balance/status card
│   │   └── ProofUpload.tsx     # File upload for proofs
│   ├── finance/
│   │   ├── FinanceTable.tsx    # Main report table
│   │   ├── FinanceFilters.tsx  # Date/status filters
│   │   └── ExportButton.tsx    # CSV/PDF export
│   └── common/
│       ├── DataTable.tsx       # Reusable table component
│       ├── StatusBadge.tsx     # Status pill component
│       ├── MoneyDisplay.tsx    # Currency formatting
│       └── DatePicker.tsx      # Date input
├── pages/
│   ├── Dashboard.tsx           # Landing/overview
│   ├── CasesList.tsx           # All cases
│   ├── CaseDetail.tsx          # Single case view
│   ├── CaseNew.tsx             # New case form
│   ├── PaymentsConsole.tsx     # Payments management
│   ├── ApprovalQueue.tsx       # Pending approvals
│   ├── FinanceReport.tsx       # Finance dashboard
│   └── ManualIntake.tsx        # Manual data entry
├── hooks/
│   ├── useCases.ts             # Case CRUD operations
│   ├── usePayments.ts          # Payment operations
│   ├── useAuth.ts              # Authentication state
│   └── useSupabase.ts          # Supabase client
├── lib/
│   ├── supabase.ts             # Supabase client config
│   ├── calculations.ts         # Payment calculations
│   ├── formatters.ts           # Money/date formatting
│   └── i18n.ts                 # Translations (EN/ES)
└── types/
    ├── database.ts             # Supabase generated types
    └── index.ts                # App-specific types
```

---

## 6. Migration Steps

### Phase 1: Infrastructure (Week 1)
1. [ ] Set up Supabase project
2. [ ] Create database schema
3. [ ] Configure authentication (Google OAuth)
4. [ ] Set up storage buckets
5. [ ] Initialize React project with Vite

### Phase 2: Data Migration (Week 2)
1. [ ] Export data from Google Sheets to JSON
2. [ ] Write migration scripts
3. [ ] Validate data integrity (especially centavo precision)
4. [ ] Import historical payments
5. [ ] Verify totals match

### Phase 3: Core Features (Weeks 3-4)
1. [ ] Authentication flow
2. [ ] Cases list and detail views
3. [ ] Payment recording with proof upload
4. [ ] Payment schedule display
5. [ ] Basic search and filters

### Phase 4: Business Logic (Week 5)
1. [ ] Payment calculations (matching current precision)
2. [ ] Amortization schedules
3. [ ] Status updates and workflows
4. [ ] Email notifications (via Supabase Edge Functions)

### Phase 5: Advanced Features (Week 6)
1. [ ] Finance reporting
2. [ ] Approval queue
3. [ ] CSV/PDF exports
4. [ ] Audit logging

### Phase 6: Deployment & Testing (Week 7)
1. [ ] Deploy to Lightsail
2. [ ] Configure Apache for cms.manaakumal.com
3. [ ] SSL certificate (Let's Encrypt)
4. [ ] User acceptance testing
5. [ ] Go-live

---

## 7. Deployment Configuration

### Apache Virtual Host (cms.manaakumal.com)
```apache
<VirtualHost *:80>
    ServerName cms.manaakumal.com
    DocumentRoot /opt/bitnami/apache/htdocs/cms
    
    <Directory /opt/bitnami/apache/htdocs/cms>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # React Router - serve index.html for all routes
    <IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </IfModule>
    
    ErrorLog logs/cms-error.log
    CustomLog logs/cms-access.log combined
</VirtualHost>
```

### Deploy Script
```bash
#!/bin/bash
# Build and deploy to Lightsail

# Build
npm run build

# Deploy
scp -i ~/Downloads/"LightsailDefaultKey-us-west-2 (1).pem" -r dist/* \
  bitnami@44.241.184.228:/opt/bitnami/apache/htdocs/cms/
```

---

## 8. Future API Bridge Strategy

Once cms.manaakumal.com is stable, create API endpoints to share data with:

### Cross-System APIs
```
/api/v1/cases/:id/summary     → For investors.manaakumal.com
/api/v1/finance/monthly       → For cash.manaakumal.com
/api/v1/units/availability    → For website masterplan
```

This will be implemented as Supabase Edge Functions with proper authentication tokens.

---

## 9. Key Considerations

### Data Integrity
- **Centavo Precision:** Use DECIMAL(12,2) and avoid any rounding
- **Audit Trail:** Log all changes with actor and timestamp
- **Backup:** Daily automated backups via Supabase

### Security
- **Authentication:** Google OAuth for staff only
- **Authorization:** Role-based access (admin, finance, legal, viewer)
- **RLS:** PostgreSQL Row Level Security for data isolation

### Performance
- **Pagination:** Limit result sets, use cursor-based pagination
- **Caching:** TanStack Query for client-side caching
- **Indexes:** Proper database indexes on frequently queried columns
