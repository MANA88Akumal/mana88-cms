// Manual Intake Page - Bulk import and legacy data entry
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { 
  Upload, FileSpreadsheet, AlertCircle, 
  RefreshCw, Download, X, ChevronDown, ChevronUp,
  FileText, Users, DollarSign, Calendar
} from 'lucide-react';
import { formatMXN } from '../lib/utils';

type ImportType = 'cases' | 'payments' | 'units' | 'clients';

interface ImportRow {
  rowNum: number;
  data: Record<string, unknown>;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

interface ImportResult {
  total: number;
  success: number;
  errors: number;
  rows: ImportRow[];
}

const IMPORT_TEMPLATES: Record<ImportType, { fields: string[]; description: string }> = {
  cases: {
    fields: ['case_id', 'unit_id', 'buyer_name', 'buyer_email', 'buyer_phone', 'sale_price', 'plan_code', 'status', 'broker_name', 'broker_email', 'contract_date'],
    description: 'Import sale cases with buyer and plan information'
  },
  payments: {
    fields: ['case_id', 'payment_date', 'amount', 'payment_type', 'channel', 'reference', 'notes'],
    description: 'Import historical payment records'
  },
  units: {
    fields: ['manzana', 'lot', 'area_m2', 'base_price', 'status', 'features'],
    description: 'Import property units and pricing'
  },
  clients: {
    fields: ['name', 'email', 'phone', 'rfc', 'curp', 'address', 'nationality', 'entity_type'],
    description: 'Import client contact information'
  }
};

export function ManualIntake() {
  const [importType, setImportType] = useState<ImportType>('cases');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const queryClient = useQueryClient();

  // Parse CSV file
  const parseCSV = useCallback((content: string): Record<string, unknown>[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const rows: Record<string, unknown>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: Record<string, unknown> = {};
      
      headers.forEach((header, idx) => {
        let value: unknown = values[idx] || '';
        // Try to parse numbers
        if (value && !isNaN(Number(value))) {
          value = Number(value);
        }
        row[header] = value;
      });
      
      rows.push(row);
    }
    
    return rows;
  }, []);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setFile(file);
    setImportResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const data = parseCSV(content);
      setParsedData(data);
    };
    reader.readAsText(file);
  }, [parseCSV]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
    },
    maxFiles: 1,
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>[]) => {
      const results: ImportRow[] = [];
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const importRow: ImportRow = {
          rowNum: i + 2, // +2 for header and 0-index
          data: row,
          status: 'pending'
        };
        
        try {
          // Determine the table and transform data based on import type
          let table = '';
          let insertData: Record<string, unknown> = {};
          
          switch (importType) {
            case 'cases':
              table = 'cases';
              insertData = {
                case_id: row.case_id,
                unit_id: row.unit_id,
                buyer_name: row.buyer_name,
                buyer_email: row.buyer_email,
                buyer_phone: row.buyer_phone,
                sale_price: Number(row.sale_price) || 0,
                plan_code: row.plan_code,
                status: row.status || 'pending',
                broker_name: row.broker_name,
                broker_email: row.broker_email,
                contract_date: row.contract_date || null,
              };
              break;
              
            case 'payments':
              table = 'payments';
              insertData = {
                case_id: row.case_id,
                payment_date: row.payment_date,
                amount: Number(row.amount) || 0,
                payment_type: row.payment_type,
                channel: row.channel,
                reference: row.reference,
                notes: row.notes,
              };
              break;
              
            case 'units':
              table = 'units';
              insertData = {
                manzana: row.manzana,
                lot: String(row.lot),
                area_m2: Number(row.area_m2) || 0,
                base_price: Number(row.base_price) || 0,
                status: row.status || 'available',
                features: row.features ? JSON.parse(String(row.features)) : null,
              };
              break;
              
            case 'clients':
              table = 'clients';
              insertData = {
                name: row.name,
                email: row.email,
                phone: row.phone,
                rfc: row.rfc,
                curp: row.curp,
                address: row.address,
                nationality: row.nationality,
                entity_type: row.entity_type || 'individual',
              };
              break;
          }
          
          const { error } = await supabase.from(table).insert(insertData);
          
          if (error) throw error;
          
          importRow.status = 'success';
          importRow.message = 'Imported successfully';
        } catch (error) {
          importRow.status = 'error';
          importRow.message = error instanceof Error ? error.message : 'Unknown error';
        }
        
        results.push(importRow);
      }
      
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      
      setImportResult({
        total: results.length,
        success: successCount,
        errors: errorCount,
        rows: results
      });
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: [importType] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    }
  });

  // Handle import
  const handleImport = () => {
    if (parsedData.length === 0) return;
    setIsProcessing(true);
    importMutation.mutate(parsedData, {
      onSettled: () => setIsProcessing(false)
    });
  };

  // Clear file
  const clearFile = () => {
    setFile(null);
    setParsedData([]);
    setImportResult(null);
  };

  // Download template
  const downloadTemplate = () => {
    const template = IMPORT_TEMPLATES[importType];
    const csvContent = template.fields.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${importType}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ImportTypeIcon = ({ type }: { type: ImportType }) => {
    switch (type) {
      case 'cases': return <FileText className="h-5 w-5" />;
      case 'payments': return <DollarSign className="h-5 w-5" />;
      case 'units': return <Calendar className="h-5 w-5" />;
      case 'clients': return <Users className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manual Intake</h1>
        <p className="text-gray-600 mt-1">Import bulk data or add legacy records</p>
      </div>

      {/* Import Type Selection */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Select Import Type</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(IMPORT_TEMPLATES) as ImportType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setImportType(type);
                clearFile();
              }}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                importType === type
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg mb-3 ${
                importType === type ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
              }`}>
                <ImportTypeIcon type={type} />
              </div>
              <h3 className="font-medium text-gray-900 capitalize">{type}</h3>
              <p className="text-sm text-gray-500 mt-1">{IMPORT_TEMPLATES[type].description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">2. Upload CSV File</h2>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Template
          </button>
        </div>

        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">
              {isDragActive
                ? 'Drop the CSV file here...'
                : 'Drag & drop a CSV file here, or click to select'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Required fields: {IMPORT_TEMPLATES[importType].fields.join(', ')}
            </p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-10 w-10 text-emerald-600" />
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {parsedData.length} rows found • {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Data Preview */}
      {parsedData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              3. Preview Data ({parsedData.length} rows)
            </h2>
            {showPreview ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {showPreview && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
                    {Object.keys(parsedData[0] || {}).slice(0, 6).map((key) => (
                      <th key={key} className="px-4 py-2 text-left font-medium text-gray-600">
                        {key}
                      </th>
                    ))}
                    {Object.keys(parsedData[0] || {}).length > 6 && (
                      <th className="px-4 py-2 text-left font-medium text-gray-600">...</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsedData.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-500">{idx + 1}</td>
                      {Object.values(row).slice(0, 6).map((val, vidx) => (
                        <td key={vidx} className="px-4 py-2 text-gray-900">
                          {typeof val === 'number' && val > 1000
                            ? formatMXN(val)
                            : String(val || '-')}
                        </td>
                      ))}
                      {Object.values(row).length > 6 && (
                        <td className="px-4 py-2 text-gray-400">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 5 && (
                <p className="text-sm text-gray-500 mt-2 px-4">
                  Showing first 5 of {parsedData.length} rows
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{importResult.total}</p>
              <p className="text-sm text-gray-600">Total Rows</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{importResult.success}</p>
              <p className="text-sm text-green-700">Successful</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{importResult.errors}</p>
              <p className="text-sm text-red-700">Errors</p>
            </div>
          </div>

          {importResult.errors > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900">Error Details:</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {importResult.rows
                  .filter(r => r.status === 'error')
                  .map((row) => (
                    <div
                      key={row.rowNum}
                      className="flex items-start gap-3 p-3 bg-red-50 rounded-lg text-sm"
                    >
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">Row {row.rowNum}</p>
                        <p className="text-red-600">{row.message}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Button */}
      {parsedData.length > 0 && !importResult && (
        <div className="flex justify-end gap-4">
          <button
            onClick={clearFile}
            className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={isProcessing}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Import {parsedData.length} Records
              </>
            )}
          </button>
        </div>
      )}

      {/* Reset after import */}
      {importResult && (
        <div className="flex justify-end">
          <button
            onClick={clearFile}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            Import More Data
          </button>
        </div>
      )}
    </div>
  );
}
