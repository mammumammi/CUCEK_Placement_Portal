/**
 * @fileoverview Excel workbook worksheet structure analyzer.
 * Scans the first 15 rows of each sheet to automatically detect header rows
 * using deterministic match scoring, handles leading blank rows, title banners,
 * and empty or merged headers safely without exposing student data.
 * @module server/modules/registration/mapping/sheet-analyzer
 */

import ExcelJS from 'exceljs';
import { suggestMappingDeterministic } from './header-matcher';

export interface SheetAnalysis {
  sheetName: string;
  headerRow: number;
  headers: string[];
  rowCount: number;
}

/**
 * Extracts cell text safely, handling Excel formulas, rich text, and merged cell representations.
 */
function extractCellText(cell: ExcelJS.Cell): string {
  let val: unknown = cell.value;
  if (val === null || val === undefined) {
    return '';
  }
  if (typeof val === 'object') {
    if ('result' in val) {
      val = (val as { result: unknown }).result;
    } else if ('richText' in val) {
      val = (val as { richText: { text: string }[] }).richText
        .map((rt) => rt.text)
        .join('');
    } else if ('text' in val) {
      val = (val as { text: unknown }).text;
    }
  }
  return String(val ?? '').trim();
}

/**
 * Analyzes an uploaded Excel workbook buffer.
 *
 * For each worksheet:
 * - Scans the first 15 rows.
 * - Chooses the row with at least 3 non-empty string cells that scores the highest
 *   match score via suggestMappingDeterministic (handling title rows and blank rows).
 * - Collects the non-empty headers of that row.
 * - Returns metadata [{sheetName, headerRow, headers, rowCount}] without reading/returning data rows.
 *
 * @param buffer - Raw Excel file buffer.
 * @returns Metadata array for each worksheet.
 */
export async function analyzeWorkbook(buffer: Buffer): Promise<SheetAnalysis[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const results: SheetAnalysis[] = [];

  for (const worksheet of workbook.worksheets) {
    const totalRowCount = worksheet.rowCount;
    let bestHeaderRow = 1;
    let bestHeaders: string[] = [];
    let bestScore = -1;

    // Scan the first 15 rows (or totalRowCount if fewer)
    const maxRowToScan = Math.min(15, totalRowCount || 15);

    for (let rowNum = 1; rowNum <= maxRowToScan; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowValues: string[] = [];

      row.eachCell({ includeEmpty: false }, (cell) => {
        const text = extractCellText(cell);
        if (text) {
          rowValues.push(text);
        }
      });

      // Must have at least 3 non-empty string cells to qualify as a header row candidate
      if (rowValues.length < 3) {
        continue;
      }

      // Compute deterministic match score using suggestMappingDeterministic
      const { mapping } = suggestMappingDeterministic(rowValues);
      let matchCount = 0;
      let totalConfidence = 0;

      for (const val of rowValues) {
        const match = mapping[val];
        if (match && match.field !== null) {
          matchCount++;
          totalConfidence += match.confidence;
        }
      }

      // Prioritize rows that match recognized canonical columns
      // Score combines number of recognized matches and confidence
      const rowScore = matchCount * 10 + totalConfidence;

      if (rowScore > bestScore) {
        bestScore = rowScore;
        bestHeaderRow = rowNum;
        bestHeaders = rowValues;
      }
    }

    // If no row had >= 3 non-empty cells or scored positively, fallback to row 1 non-empty cells
    if (bestScore <= 0 && bestHeaders.length === 0) {
      const fallbackRow = worksheet.getRow(1);
      const fallbackHeaders: string[] = [];
      fallbackRow.eachCell({ includeEmpty: false }, (cell) => {
        const text = extractCellText(cell);
        if (text) fallbackHeaders.push(text);
      });
      bestHeaderRow = 1;
      bestHeaders = fallbackHeaders;
    }

    results.push({
      sheetName: worksheet.name,
      headerRow: bestHeaderRow,
      headers: bestHeaders,
      rowCount: totalRowCount,
    });
  }

  return results;
}

