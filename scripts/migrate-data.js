#!/usr/bin/env node
/**
 * MANA88 Data Migration Script
 * Converts Google Sheets CSV exports to PostgreSQL/Supabase format
 * 
 * Usage:
 *   node migrate-data.js --cases ./MANA88_Cases.csv --payments ./All_Payments.csv
 *   
 * Output:
 *   - clients.sql
 *   - units.sql
 *   - cases.sql
 *   - payments.sql
 *   - payment_schedule.sql
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// ============================================
// CONFIGURATION
// ============================================

const OUTPUT_DIR = './migration-output';

// Payment type mapping (legacy → new enum)
const PAYMENT_TYPE_MAP = {
  'DOWN PAYMENT': 'enganche',
  'LOAN PAYMENT': 'mensualidad',
  'RESERVATION': 'reserva',
  'FINAL PAYMENT': 'entrega',
  'MONTHLY': 'mensualidad',
  'reserva': 'reserva',
  'enganche': 'enganche',
  'mensualidad': 'mensualidad',
  'entrega': 'entrega',
};

// ============================================
// HELPERS
// ============================================

function parseAmount(str) {
  if (!str) return 0;
  // Remove $ and , from amounts like "$199,669.05"
  const cleaned = String(str).replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100; // Preserve centavo precision
}

function parseDate(str) {
  if (!str) return null;
  // Handle various date formats
  const dateStr = String(str).trim();
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.substring(0, 10);
  }
  
  // Try MM/DD/YYYY format
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return null;
}

function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function toJSON(obj) {
  if (!obj) return 'NULL';
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`;
}

function generateUUID() {
  return 'gen_random_uuid()';
}

// ============================================
// PARSERS
// ============================================

function parseCasesCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  const cases = [];
  const clients = new Map(); // email → client data
  const units = new Map(); // manzana-lot → unit data
  
  for (const row of records) {
    const caseId = row['Case ID'];
    if (!caseId || !caseId.startsWith('MANA88')) continue;
    
    // Parse DTO JSON
    let dto = {};
    try {
      dto = JSON.parse(row['DTO JSON'] || '{}');
    } catch (e) {
      console.warn(`Failed to parse DTO for ${caseId}:`, e.message);
    }
    
    // Extract data from DTO
    const buyerName = dto.buyers?.b1 || '';
    const buyerName2 = dto.buyers?.b2 || '';
    const email1 = dto.contacts?.email1 || '';
    const email2 = dto.contacts?.email2 || '';
    const phone1 = dto.contacts?.phone1 || '';
    const phone2 = dto.contacts?.phone2 || '';
    const manzana = dto.property?.manzana || '';
    const lot = dto.property?.lot || '';
    const listPrice = parseAmount(dto.pricing?.list);
    const salePrice = parseAmount(dto.pricing?.sale);
    const planName = dto.plan?.name || '';
    const downPaymentPct = parseFloat(dto.plan?.downPct) || null;
    const downPaymentMxn = parseAmount(dto.plan?.downMx);
    const brokerName = dto.broker?.name || row['Broker Name'] || '';
    const brokerAgency = dto.broker?.agency || row['Broker Agency'] || '';
    const brokerEmail = dto.broker?.email || row['Broker Email'] || '';
    const brokerPhone = dto.broker?.phone || row['Broker Phone'] || '';
    const scheduleRaw = dto.scheduleRaw || [];
    const status = mapStatus(row['Status']);
    
    // Create client entry
    if (buyerName) {
      const clientKey = email1 || `${buyerName}-${phone1}`;
      if (!clients.has(clientKey)) {
        clients.set(clientKey, {
          full_name: buyerName,
          full_name_secondary: buyerName2 || null,
          email_primary: email1 || null,
          email_secondary: email2 || null,
          phone_primary: phone1 || null,
          phone_secondary: phone2 || null,
          id_document_url: dto.buyers?.idUrl || dto.contract?.buyerIdUrl || null,
          address_line1: dto.contract?.buyerAddress || null,
        });
      }
    }
    
    // Create unit entry
    if (manzana && lot) {
      const unitKey = `${manzana}-${lot}`;
      if (!units.has(unitKey)) {
        units.set(unitKey, {
          manzana,
          lot,
          list_price_mxn: listPrice || null,
          status: status === 'executed' ? 'sold' : 'reserved',
        });
      }
    }
    
    // Create case entry
    cases.push({
      case_id: caseId,
      unit_key: manzana && lot ? `${manzana}-${lot}` : null,
      client_key: buyerName ? (email1 || `${buyerName}-${phone1}`) : null,
      list_price_mxn: listPrice || null,
      sale_price_mxn: salePrice,
      plan_name: planName,
      down_payment_pct: downPaymentPct,
      down_payment_mxn: downPaymentMxn || null,
      broker_name: brokerName || null,
      broker_agency: brokerAgency || null,
      broker_email: brokerEmail || null,
      broker_phone: brokerPhone || null,
      status,
      offer_doc_url: row['Offer Doc URL'] || null,
      offer_pdf_url: row['Offer PDF URL'] || null,
      folder_url: row['Folder URL'] || null,
      schedule_raw: scheduleRaw,
      dto_json: dto,
      version: parseInt(row['Version']) || 1,
      updated_at: row['Updated At'] || null,
    });
  }
  
  return { cases, clients, units };
}

function parsePaymentsCSV(csvContent) {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  
  const payments = [];
  
  for (const row of records) {
    const caseId = row['Case ID'];
    if (!caseId || !caseId.startsWith('MANA88')) continue;
    
    const paymentDate = parseDate(row['Payment Date']) || parseDate(row['Timestamp']);
    const amount = parseAmount(row['Amount Paid (MXN)']);
    const paymentType = PAYMENT_TYPE_MAP[row['Payment Type']?.toUpperCase()] || 'mensualidad';
    
    if (!paymentDate || amount <= 0) continue;
    
    payments.push({
      case_id: caseId, // Will be resolved to UUID later
      payment_date: paymentDate,
      payment_month: paymentDate.substring(0, 7),
      amount_mxn: amount,
      currency_original: row['Currency'] || 'MXN',
      payment_type: paymentType,
      applied_to_installment: parseInt(row['Applied To Installment #']) || null,
      mana_proof_url: row['MANA_Proof_URL'] || null,
      client_proof_url: row['Client_Proof_URL'] || null,
      channel: row['Channel'] || null,
      reference_number: row['Reference #'] || null,
      entered_by: row['Entered By'] || null,
      source: row['Source'] || 'legacy-import',
      notes: row['Notes'] || null,
      audit_id: row['Audit ID'] || null,
    });
  }
  
  return payments;
}

function mapStatus(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('contract generated')) return 'contract_generated';
  if (statusLower.includes('executed')) return 'executed';
  if (statusLower.includes('cancelled') || statusLower.includes('canceled')) return 'cancelled';
  if (statusLower.includes('active')) return 'active';
  if (statusLower.includes('hold')) return 'on_hold';
  return 'pending';
}

// ============================================
// SQL GENERATORS
// ============================================

function generateClientsSql(clients) {
  const lines = ['-- Clients Migration', ''];
  
  for (const [key, client] of clients) {
    lines.push(`INSERT INTO clients (id, full_name, full_name_secondary, email_primary, email_secondary, phone_primary, phone_secondary, id_document_url, address_line1)
VALUES (
  ${generateUUID()},
  ${escapeSQL(client.full_name)},
  ${escapeSQL(client.full_name_secondary)},
  ${escapeSQL(client.email_primary)},
  ${escapeSQL(client.email_secondary)},
  ${escapeSQL(client.phone_primary)},
  ${escapeSQL(client.phone_secondary)},
  ${escapeSQL(client.id_document_url)},
  ${escapeSQL(client.address_line1)}
)
ON CONFLICT (email_primary) DO NOTHING;
`);
  }
  
  return lines.join('\n');
}

function generateUnitsSql(units) {
  const lines = ['-- Units Migration', ''];
  
  for (const [key, unit] of units) {
    lines.push(`INSERT INTO units (id, manzana, lot, list_price_mxn, status)
VALUES (
  ${generateUUID()},
  ${escapeSQL(unit.manzana)},
  ${escapeSQL(unit.lot)},
  ${unit.list_price_mxn || 'NULL'},
  ${escapeSQL(unit.status)}
)
ON CONFLICT (manzana, lot) DO UPDATE SET
  list_price_mxn = COALESCE(EXCLUDED.list_price_mxn, units.list_price_mxn),
  status = EXCLUDED.status;
`);
  }
  
  return lines.join('\n');
}

function generateCasesSql(cases) {
  const lines = ['-- Cases Migration', ''];
  
  for (const c of cases) {
    lines.push(`INSERT INTO cases (
  id, case_id, 
  unit_id, client_id,
  list_price_mxn, sale_price_mxn,
  plan_name, down_payment_pct, down_payment_mxn,
  broker_name, broker_agency, broker_email, broker_phone,
  status,
  offer_doc_url, offer_pdf_url, folder_url,
  schedule_raw, dto_json,
  version
)
SELECT
  ${generateUUID()},
  ${escapeSQL(c.case_id)},
  ${c.unit_key ? `(SELECT id FROM units WHERE manzana || '-' || lot = ${escapeSQL(c.unit_key)} LIMIT 1)` : 'NULL'},
  ${c.client_key ? `(SELECT id FROM clients WHERE email_primary = ${escapeSQL(c.client_key.includes('@') ? c.client_key : null)} OR full_name = ${escapeSQL(c.client_key.includes('@') ? null : c.client_key.split('-')[0])} LIMIT 1)` : 'NULL'},
  ${c.list_price_mxn || 'NULL'},
  ${c.sale_price_mxn},
  ${escapeSQL(c.plan_name)},
  ${c.down_payment_pct || 'NULL'},
  ${c.down_payment_mxn || 'NULL'},
  ${escapeSQL(c.broker_name)},
  ${escapeSQL(c.broker_agency)},
  ${escapeSQL(c.broker_email)},
  ${escapeSQL(c.broker_phone)},
  ${escapeSQL(c.status)},
  ${escapeSQL(c.offer_doc_url)},
  ${escapeSQL(c.offer_pdf_url)},
  ${escapeSQL(c.folder_url)},
  ${toJSON(c.schedule_raw)},
  ${toJSON(c.dto_json)},
  ${c.version}
ON CONFLICT (case_id) DO NOTHING;
`);
  }
  
  return lines.join('\n');
}

function generatePaymentsSql(payments) {
  const lines = ['-- Payments Migration', ''];
  
  for (const p of payments) {
    lines.push(`INSERT INTO payments (
  id, case_id,
  payment_date, payment_month,
  amount_mxn, currency_original,
  payment_type, applied_to_installment,
  mana_proof_url, client_proof_url,
  channel, reference_number,
  entered_by, source, notes,
  audit_id
)
SELECT
  ${generateUUID()},
  (SELECT id FROM cases WHERE case_id = ${escapeSQL(p.case_id)} LIMIT 1),
  ${escapeSQL(p.payment_date)}::date,
  ${escapeSQL(p.payment_month)},
  ${p.amount_mxn},
  ${escapeSQL(p.currency_original)},
  ${escapeSQL(p.payment_type)}::payment_type,
  ${p.applied_to_installment || 'NULL'},
  ${escapeSQL(p.mana_proof_url)},
  ${escapeSQL(p.client_proof_url)},
  ${escapeSQL(p.channel)},
  ${escapeSQL(p.reference_number)},
  ${escapeSQL(p.entered_by)},
  ${escapeSQL(p.source)},
  ${escapeSQL(p.notes)},
  ${p.audit_id ? escapeSQL(p.audit_id) + '::uuid' : generateUUID()}
WHERE EXISTS (SELECT 1 FROM cases WHERE case_id = ${escapeSQL(p.case_id)});
`);
  }
  
  return lines.join('\n');
}

function generatePaymentScheduleSql(cases) {
  const lines = ['-- Payment Schedule Migration', ''];
  
  for (const c of cases) {
    if (!c.schedule_raw || !Array.isArray(c.schedule_raw)) continue;
    
    c.schedule_raw.forEach((item, index) => {
      const paymentType = PAYMENT_TYPE_MAP[item.type?.toLowerCase()] || item.type || 'mensualidad';
      const dueDate = parseDate(item.date);
      const amount = parseAmount(item.amount);
      
      if (!dueDate || amount <= 0) return;
      
      lines.push(`INSERT INTO payment_schedule (
  id, case_id,
  schedule_index, payment_type, label,
  amount_mxn, due_date, status
)
SELECT
  ${generateUUID()},
  (SELECT id FROM cases WHERE case_id = ${escapeSQL(c.case_id)} LIMIT 1),
  ${index},
  ${escapeSQL(paymentType)}::payment_type,
  ${escapeSQL(item.label)},
  ${amount},
  ${escapeSQL(dueDate)}::date,
  'pending'
WHERE EXISTS (SELECT 1 FROM cases WHERE case_id = ${escapeSQL(c.case_id)})
ON CONFLICT (case_id, schedule_index) DO NOTHING;
`);
    });
  }
  
  return lines.join('\n');
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let casesFile, paymentsFile;
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--cases') casesFile = args[i + 1];
    if (args[i] === '--payments') paymentsFile = args[i + 1];
  }
  
  if (!casesFile) {
    console.error('Usage: node migrate-data.js --cases <cases.csv> [--payments <payments.csv>]');
    process.exit(1);
  }
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  console.log('🚀 Starting MANA88 Data Migration...\n');
  
  // Parse cases CSV
  console.log(`📁 Reading cases from: ${casesFile}`);
  const casesContent = fs.readFileSync(casesFile, 'utf-8');
  const { cases, clients, units } = parseCasesCSV(casesContent);
  console.log(`   Found ${cases.length} cases, ${clients.size} unique clients, ${units.size} unique units\n`);
  
  // Parse payments CSV (if provided)
  let payments = [];
  if (paymentsFile) {
    console.log(`📁 Reading payments from: ${paymentsFile}`);
    const paymentsContent = fs.readFileSync(paymentsFile, 'utf-8');
    payments = parsePaymentsCSV(paymentsContent);
    console.log(`   Found ${payments.length} payments\n`);
  }
  
  // Generate SQL files
  console.log('📝 Generating SQL migration files...\n');
  
  fs.writeFileSync(path.join(OUTPUT_DIR, '01_clients.sql'), generateClientsSql(clients));
  console.log('   ✅ 01_clients.sql');
  
  fs.writeFileSync(path.join(OUTPUT_DIR, '02_units.sql'), generateUnitsSql(units));
  console.log('   ✅ 02_units.sql');
  
  fs.writeFileSync(path.join(OUTPUT_DIR, '03_cases.sql'), generateCasesSql(cases));
  console.log('   ✅ 03_cases.sql');
  
  fs.writeFileSync(path.join(OUTPUT_DIR, '04_payment_schedule.sql'), generatePaymentScheduleSql(cases));
  console.log('   ✅ 04_payment_schedule.sql');
  
  if (payments.length > 0) {
    fs.writeFileSync(path.join(OUTPUT_DIR, '05_payments.sql'), generatePaymentsSql(payments));
    console.log('   ✅ 05_payments.sql');
  }
  
  // Summary
  console.log('\n📊 Migration Summary:');
  console.log(`   - Clients: ${clients.size}`);
  console.log(`   - Units: ${units.size}`);
  console.log(`   - Cases: ${cases.length}`);
  console.log(`   - Payments: ${payments.length}`);
  
  console.log(`\n🎉 SQL files generated in: ${OUTPUT_DIR}/`);
  console.log('\nTo apply migration, run SQL files in order:');
  console.log('  1. Run schema migration first (001_initial_schema.sql)');
  console.log('  2. Then run data migrations in order (01_clients.sql, etc.)');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
