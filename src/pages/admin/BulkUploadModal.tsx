import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Collection, Product } from '../../types';
import {
  downloadSampleTemplate,
  parseBulkFile,
  BulkParseResult,
} from '../../utils/bulkProductUpload';
import { slugFromName } from '../../utils/slug';
import { getFirebaseErrorMessage } from '../../supabase/errors';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  addProduct: (data: Omit<Product, 'id' | 'createdAt' | 'isDeleted'>) => Promise<string>;
}

interface RowResult {
  rowNumber: number;
  name: string;
  ok: boolean;
  message: string;
}

export default function BulkUploadModal({
  isOpen,
  onClose,
  collections,
  addProduct,
}: BulkUploadModalProps) {
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parseResult, setParseResult] = useState<BulkParseResult | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<RowResult[] | null>(null);

  if (!isOpen) return null;

  const resetAll = () => {
    setFileName('');
    setParseError('');
    setParseResult(null);
    setResults(null);
    setProgress({ done: 0, total: 0 });
  };

  const handleClose = () => {
    if (isUploading) return; // don't allow closing mid-upload
    resetAll();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    resetAll();
    setFileName(file.name);
    setIsParsing(true);
    try {
      const result = await parseBulkFile(file, collections);
      setParseResult(result);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Could not read that file. Make sure it is a valid .xlsx, .xls, or .csv file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleUploadAll = async () => {
    if (!parseResult) return;
    const validRows = parseResult.rows.filter((r) => r.data !== null);
    if (validRows.length === 0) return;

    setIsUploading(true);
    setProgress({ done: 0, total: validRows.length });
    const rowResults: RowResult[] = [];

    for (const row of validRows) {
      try {
        const slug = slugFromName(row.data!.name);
        await addProduct({ ...row.data!, slug });
        rowResults.push({ rowNumber: row.rowNumber, name: row.data!.name, ok: true, message: 'Added' });
      } catch (err) {
        rowResults.push({
          rowNumber: row.rowNumber,
          name: row.data!.name,
          ok: false,
          message: getFirebaseErrorMessage(err, 'Failed to add this product.'),
        });
      }
      setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    setResults(rowResults);
    setIsUploading(false);
  };

  const invalidRows = parseResult?.rows.filter((r) => r.data === null) ?? [];
  const successCount = results?.filter((r) => r.ok).length ?? 0;
  const failCount = results?.filter((r) => !r.ok).length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#B8860B]/15 sticky top-0 bg-white z-10">
          <h2 className="font-serif text-xl font-bold text-[#1C1008]">Bulk Upload Sarees</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-[#1C1008] disabled:opacity-30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5 text-xs sm:text-sm">
          {/* Step 1: download template */}
          <div className="flex flex-col gap-2">
            <p className="font-bold uppercase tracking-wider text-[#1C1008]">Step 1 — Get the template</p>
            <p className="text-gray-500">
              Download the sample spreadsheet, fill in one row per saree, then upload it below.
              The "Instructions" sheet inside lists your exact collection names.
            </p>
            <button
              type="button"
              onClick={() => downloadSampleTemplate(collections)}
              className="self-start inline-flex items-center gap-2 border border-[#B8860B] text-[#7A1C2E] hover:bg-[#B8860B]/10 py-2 px-4 rounded text-xs font-extrabold uppercase transition-all"
            >
              <Download className="h-4 w-4" />
              Download Sample Template
            </button>
          </div>

          {/* Step 2: upload filled file */}
          <div className="flex flex-col gap-2 border-t border-[#B8860B]/15 pt-5">
            <p className="font-bold uppercase tracking-wider text-[#1C1008]">Step 2 — Upload your filled file</p>
            <label className="self-start inline-flex items-center gap-2 bg-[#7A1C2E] hover:bg-[#1C1008] text-white py-2 px-4 rounded text-xs font-extrabold uppercase transition-all cursor-pointer">
              <Upload className="h-4 w-4" />
              Choose File
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isUploading}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="text-gray-500 flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                {fileName}
              </p>
            )}
            {isParsing && (
              <p className="text-gray-500 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading file...
              </p>
            )}
            {parseError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-700 p-3 rounded flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {/* Step 3: preview + confirm */}
          {parseResult && !results && (
            <div className="flex flex-col gap-3 border-t border-[#B8860B]/15 pt-5">
              <p className="font-bold uppercase tracking-wider text-[#1C1008]">Step 3 — Review &amp; upload</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> {parseResult.validCount} ready to upload
                </span>
                {parseResult.invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                    <XCircle className="h-4 w-4" /> {parseResult.invalidCount} have errors
                  </span>
                )}
              </div>

              {invalidRows.length > 0 && (
                <div className="max-h-40 overflow-y-auto bg-red-500/5 border border-red-500/15 rounded p-3 flex flex-col gap-2">
                  {invalidRows.map((row) => (
                    <div key={row.rowNumber} className="text-red-700">
                      <span className="font-semibold">Row {row.rowNumber}:</span> {row.errors.join(' ')}
                    </div>
                  ))}
                </div>
              )}

              {isUploading ? (
                <div className="flex flex-col gap-2">
                  <p className="text-gray-500 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Uploading {progress.done} of {progress.total}...
                  </p>
                  <div className="h-2 bg-[#B8860B]/15 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#7A1C2E] transition-all"
                      style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleUploadAll}
                  disabled={parseResult.validCount === 0}
                  className="self-start inline-flex items-center gap-2 bg-[#7A1C2E] hover:bg-[#1C1008] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-2.5 px-5 rounded text-xs font-extrabold uppercase transition-all shadow"
                >
                  <Upload className="h-4 w-4" />
                  Upload {parseResult.validCount} Product{parseResult.validCount === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}

          {/* Step 4: final results */}
          {results && (
            <div className="flex flex-col gap-3 border-t border-[#B8860B]/15 pt-5">
              <p className="font-bold uppercase tracking-wider text-[#1C1008]">Done</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5 text-green-700 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> {successCount} added
                </span>
                {failCount > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                    <XCircle className="h-4 w-4" /> {failCount} failed
                  </span>
                )}
              </div>
              {failCount > 0 && (
                <div className="max-h-40 overflow-y-auto bg-red-500/5 border border-red-500/15 rounded p-3 flex flex-col gap-2">
                  {results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <div key={r.rowNumber} className="text-red-700">
                        <span className="font-semibold">Row {r.rowNumber} ({r.name}):</span> {r.message}
                      </div>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="border border-[#B8860B] text-[#7A1C2E] hover:bg-[#B8860B]/10 py-2 px-4 rounded text-xs font-extrabold uppercase transition-all"
                >
                  Upload Another File
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="bg-[#7A1C2E] hover:bg-[#1C1008] text-white py-2 px-4 rounded text-xs font-extrabold uppercase transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}