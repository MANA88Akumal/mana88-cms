# MANA88 CMS - Deployment Guide

## Overview
MANA88 CMS is a property sales management system built with React, TypeScript, and Supabase (PostgreSQL). It deploys to AWS Lightsail at `cms.manaakumal.com`.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Hosting**: AWS Lightsail (Apache)
- **Domain**: cms.manaakumal.com

## Prerequisites
- Node.js 18+ and npm
- Supabase account
- AWS Lightsail server (44.241.184.228)
- Domain DNS configured

---

## Step 1: Supabase Setup

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project in your organization
3. Note down:
   - Project URL: `https://your-project.supabase.co`
   - Anon Key: (from Settings → API)
   - Project ID: (from Settings → General)

### 1.2 Run Database Migration
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Run migration
supabase db push
```

Or manually run the SQL in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL Editor.

### 1.3 Configure Storage Buckets
In Supabase Dashboard → Storage:
1. Create bucket: `payment-proofs` (public)
2. Create bucket: `case-documents` (public)

### 1.4 Enable Google OAuth
In Supabase Dashboard → Authentication → Providers:
1. Enable Google provider
2. Add Client ID and Secret from Google Cloud Console
3. Add redirect URL: `https://cms.manaakumal.com/auth/callback`

---

## Step 2: Local Development Setup

### 2.1 Clone and Install
```bash
cd mana88-cms
npm install
```

### 2.2 Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.3 Run Development Server
```bash
npm run dev
```

Visit `http://localhost:5173`

---

## Step 3: Data Migration

### 3.1 Export from Google Sheets
Export these sheets from MANA88_Sales_Pipeline as CSV:
- MANA88_Cases → `data/cases.csv`
- All Payments → `data/payments.csv`

### 3.2 Run Migration Script
```bash
node scripts/migrate-data.js
```

This will:
1. Parse CSV files
2. Generate SQL insert statements
3. Create `data/migration.sql`

### 3.3 Import to Supabase
Run the generated SQL in Supabase SQL Editor, or:
```bash
psql YOUR_DATABASE_URL < data/migration.sql
```

---

## Step 4: Server Setup (AWS Lightsail)

### 4.1 Connect to Server
```bash
ssh -i ~/Downloads/"LightsailDefaultKey-us-west-2 (1).pem" bitnami@44.241.184.228
```

### 4.2 Create CMS Directory
```bash
sudo mkdir -p /opt/bitnami/apache/htdocs/cms
sudo chown -R bitnami:daemon /opt/bitnami/apache/htdocs/cms
```

### 4.3 Configure Apache VirtualHost
```bash
sudo nano /opt/bitnami/apache/conf/vhosts/cms.manaakumal.com-vhost.conf
```

Paste contents from `docs/apache-vhost.conf`

### 4.4 Enable Required Modules
```bash
sudo /opt/bitnami/apache/bin/a2enmod rewrite
sudo /opt/bitnami/apache/bin/a2enmod headers
sudo /opt/bitnami/apache/bin/a2enmod expires
```

### 4.5 Restart Apache
```bash
sudo /opt/bitnami/ctlscript.sh restart apache
```

---

## Step 5: SSL Certificate (Let's Encrypt)

### 5.1 Install Certbot
```bash
sudo apt update
sudo apt install certbot python3-certbot-apache
```

### 5.2 Generate Certificate
```bash
sudo certbot --apache -d cms.manaakumal.com
```

### 5.3 Auto-Renewal
```bash
sudo certbot renew --dry-run
```

---

## Step 6: Deploy

### 6.1 Build and Deploy
From your local machine:
```bash
npm run deploy
```

Or manually:
```bash
# Build
npm run build

# Upload
scp -i ~/Downloads/"LightsailDefaultKey-us-west-2 (1).pem" -r dist/* bitnami@44.241.184.228:/opt/bitnami/apache/htdocs/cms/
```

### 6.2 Verify Deployment
Visit: https://cms.manaakumal.com

---

## DNS Configuration

Add these records in your DNS provider:

| Type | Name | Value |
|------|------|-------|
| A | cms | 44.241.184.228 |

---

## Maintenance

### View Logs
```bash
# Apache error logs
sudo tail -f /opt/bitnami/apache/logs/cms-ssl-error.log

# Apache access logs
sudo tail -f /opt/bitnami/apache/logs/cms-ssl-access.log
```

### Restart Apache
```bash
sudo /opt/bitnami/ctlscript.sh restart apache
```

### Generate TypeScript Types from Supabase
```bash
npm run db:types
```

---

## File Structure
```
mana88-cms/
├── docs/
│   ├── MIGRATION_PLAN.md
│   └── apache-vhost.conf
├── public/
│   └── mana-logo.svg
├── scripts/
│   ├── deploy.sh
│   └── migrate-data.js
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppLayout.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCases.ts
│   │   └── usePayments.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── ApprovalQueue.tsx
│   │   ├── AuthCallback.tsx
│   │   ├── CaseDetail.tsx
│   │   ├── CaseNew.tsx
│   │   ├── CasesList.tsx
│   │   ├── Dashboard.tsx
│   │   ├── FinanceReport.tsx
│   │   ├── Login.tsx
│   │   ├── ManualIntake.tsx
│   │   └── PaymentsConsole.tsx
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── .env.example
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Related Systems

| System | Domain | Description |
|--------|--------|-------------|
| CMS | cms.manaakumal.com | Property Sales Management |
| Cash | cash.manaakumal.com | Cash Flow Management |
| Investors | investors.manaakumal.com | Investor Portal |

All systems share the same Lightsail server (44.241.184.228).

---

## Troubleshooting

### 404 on Page Refresh
Ensure `.htaccess` exists and mod_rewrite is enabled:
```bash
sudo /opt/bitnami/apache/bin/a2enmod rewrite
sudo /opt/bitnami/ctlscript.sh restart apache
```

### CORS Issues
Check Supabase project settings → API → CORS allowed origins includes your domain.

### Auth Redirect Issues
Verify the redirect URL in Supabase matches: `https://cms.manaakumal.com/auth/callback`
