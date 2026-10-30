/**
 * @fileoverview Test helper creating in-memory .xlsx buffers with exceljs.
 * @module server/modules/registration/registration.test-helper
 */

import ExcelJS from 'exceljs';

export const DEFAULT_EXCEL_HEADERS = [
  'studentId',
  'name',
  'branch',
  'batch',
  'email',
  'phone',
  'activeBacklogs',
  's1Sgpa',
  's1Credits',
  's2Sgpa',
  's2Credits',
  's3Sgpa',
  's3Credits',
  's4Sgpa',
  's4Credits',
  's5Sgpa',
  's5Credits',
  's6Sgpa',
  's6Credits',
];

/**
 * Creates an in-memory .xlsx file buffer populated with provided row objects.
 *
 * @param rows - Array of key-value student rows.
 * @param headers - Optional custom column header array override.
 * @returns In-memory Excel buffer.
 */
export async function createExcelBuffer(
  rows: Record<string, unknown>[],
  headers: string[] = DEFAULT_EXCEL_HEADERS
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  // Add header row
  worksheet.addRow(headers);

  // Add data rows
  for (const row of rows) {
    const rowValues = headers.map((h) => {
      const val = row[h];
      return val !== undefined ? val : '';
    });
    worksheet.addRow(rowValues);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

