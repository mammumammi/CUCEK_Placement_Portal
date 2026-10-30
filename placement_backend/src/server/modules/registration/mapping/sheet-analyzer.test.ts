import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { analyzeWorkbook } from './sheet-analyzer';

describe('analyzeWorkbook', () => {
  it('detects header row at row 1 for clean standard sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    sheet.addRow(['Student ID', 'Full Name', 'Branch', 'Batch', 'Email', 'Phone']);
    sheet.addRow(['2022BCSE001', 'Alice', 'CSE', '2026', 'alice@test.edu', '9876543210']);
    sheet.addRow(['2022BCSE002', 'Bob', 'CSE', '2026', 'bob@test.edu', '9876543211']);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const analysis = await analyzeWorkbook(buffer);

    expect(analysis).toHaveLength(1);
    expect(analysis[0].sheetName).toBe('Students');
    expect(analysis[0].headerRow).toBe(1);
    expect(analysis[0].headers).toEqual(['Student ID', 'Full Name', 'Branch', 'Batch', 'Email', 'Phone']);
    expect(analysis[0].rowCount).toBe(3);
  });

  it('detects header row when preceded by leading blank rows and a title banner', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Batch_2026');

    // Row 1: Blank
    sheet.addRow([]);
    // Row 2: Title Banner (merged or single cell)
    sheet.addRow(['COLLEGE OF ENGINEERING - PLACEMENT CELL']);
    // Row 3: Subtitle / department note
    sheet.addRow(['CAMPUS RECRUITMENT DRIVE 2026 ELIGIBLE STUDENTS']);
    // Row 4: Blank
    sheet.addRow([]);
    // Row 5: Actual Header Row (>= 3 columns with recognized names)
    sheet.addRow(['Reg No', 'Candidate Name', 'Dept', 'Mail Id', 'Mobile Number', 'Backlogs', 'Sem 1 SGPA']);
    // Rows 6+: Data
    sheet.addRow(['2022BCSE001', 'Charlie', 'CSE', 'charlie@test.edu', '9876543212', 0, 8.5]);
    sheet.addRow(['2022BCSE002', 'David', 'CSE', 'david@test.edu', '9876543213', 0, 9.0]);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const analysis = await analyzeWorkbook(buffer);

    expect(analysis).toHaveLength(1);
    expect(analysis[0].sheetName).toBe('Batch_2026');
    expect(analysis[0].headerRow).toBe(5);
    expect(analysis[0].headers).toEqual([
      'Reg No',
      'Candidate Name',
      'Dept',
      'Mail Id',
      'Mobile Number',
      'Backlogs',
      'Sem 1 SGPA',
    ]);
  });

  it('handles multiple worksheets safely', async () => {
    const workbook = new ExcelJS.Workbook();

    const sheet1 = workbook.addWorksheet('CSE');
    sheet1.addRow(['Roll No', 'Name', 'Branch', 'Email']);
    sheet1.addRow(['CSE01', 'Eve', 'CSE', 'eve@test.edu']);

    const sheet2 = workbook.addWorksheet('ECE');
    sheet2.addRow([]);
    sheet2.addRow(['Electronics Dept Students']);
    sheet2.addRow(['Roll No', 'Name', 'Department', 'Phone']);
    sheet2.addRow(['ECE01', 'Frank', 'ECE', '9876543214']);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const analysis = await analyzeWorkbook(buffer);

    expect(analysis).toHaveLength(2);
    expect(analysis[0].sheetName).toBe('CSE');
    expect(analysis[0].headerRow).toBe(1);

    expect(analysis[1].sheetName).toBe('ECE');
    expect(analysis[1].headerRow).toBe(3);
    expect(analysis[1].headers).toEqual(['Roll No', 'Name', 'Department', 'Phone']);
  });

  it('safely skips empty and merged cell headers without returning any student data rows', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sparse');

    const row = sheet.getRow(1);
    row.getCell(1).value = 'Student ID';
    row.getCell(2).value = ''; // empty
    row.getCell(3).value = 'Student Name';
    row.getCell(5).value = 'Official Email'; // gap at 4

    sheet.addRow(['2022BCSE001', '', 'Secret Student Data', '', 'secret@college.edu']);

    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    const analysis = await analyzeWorkbook(buffer);

    expect(analysis[0].headers).toEqual(['Student ID', 'Student Name', 'Official Email']);
    // Ensure no data row values leak into the analysis object
    const serialized = JSON.stringify(analysis);
    expect(serialized).not.toContain('Secret Student Data');
    expect(serialized).not.toContain('secret@college.edu');
  });
});
