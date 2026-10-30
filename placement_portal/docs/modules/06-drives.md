# Module Specification: Placement Drives, Analytics & Excel Reports (`drives`)

> **Module Path:** `src/server/modules/drives/`  
> **Mounted At:** `/api/drives`  
> **Storage Service:** `src/server/services/storage.service.ts`  
> **Export Service:** `src/server/modules/drives/export.service.ts`

---

## 1. Overview & Architectural Guarantees

The `drives` module manages company recruitment drives, Job Description (JD) uploads, candidate eligibility checks, round progression workflows, SQL-aggregated funnel statistics, and sanitized Excel (`.xlsx`) reporting.

Key architectural properties:
1. **File Storage Abstraction (`FileStorage`):**
   - Pluggable interface in `storage.service.ts`.
   - `LocalDiskStorage` handles local storage (`uploads/` directory), supporting transparent migration to Cloudflare R2 or S3.
2. **Pure Eligibility Engine (`evaluateEligibility`):**
   - Deterministic pure evaluation mapping a student profile against drive criteria.
   - Evaluates:
     1. `branch in eligibleBranches`.
     2. `cgpa >= minCgpa`.
     3. `activeBacklogs <= maxActiveBacklogs`.
   - Returns `{ eligible: boolean, reasons: string[] }`.
3. **Round Progression Rules:**
   - Round $N$ can only be marked as `'SHORTLISTED'` if Round $N-1$ was already `'SHORTLISTED'`.
   - `roundNumber` must not exceed `drive.totalRounds`.
   - Restricted to coordinators, scoped by branch (`BRANCH_COORDINATOR` can only update candidates in their own branch).
4. **SQL Aggregated Funnel Statistics (`getDriveStats`):**
   - Computes per-branch applied, shortlisted per round (`shortlistedByRound: number[]`), and placed counts, plus overall totals using SQL `GROUP BY` aggregations.
5. **Excel Export (`exportService` with `exceljs`):**
   - **Worksheet 1 ("Consolidated Candidates"):** VERIFIED candidates only (`S.No`, `studentId`, `name`, `branch`, `batch`, `cgpa`, `activeBacklogs`, `email`, `phone`, `resumeUrl`, and all drive `extraFields` in order).
   - **Worksheet 2 ("Branch-Wise Summary"):** Branch funnel metrics (`Branch`, `Applied`, `Round 1`..`Round N`, `Placed`, with a final `Total` row matching sums).
   - **Formula Injection Mitigation:** Any cell value starting with `=`, `+`, `-`, or `@` is sanitized by prefixing a single quote (`'`).

---

## 2. API Reference

### 2.1. `POST /api/drives`
- **Role:** `MAIN_COORDINATOR` only.
- **Content-Type:** `multipart/form-data`.
- **Form Fields:** `company`, `description`, `deadline` (future ISO date), `eligibleBranches`, `minCgpa`, `maxActiveBacklogs`, `totalRounds`, `extraFields`, `file` / `jd` (PDF, max 10MB).
- **Response (`201 Created`):** Drive entity with `open: true`.

### 2.2. `GET /api/drives`
- **Role:** All authenticated roles.
- **Response (`200 OK`):** Drive list with `open: boolean` and, for students, `eligible: boolean` and `reasons: string[]`.

### 2.3. `GET /api/drives/:driveId`
- **Role:** All authenticated roles.
- **Response (`200 OK`):** Single drive details with `open` and student eligibility breakdown.

### 2.4. `GET /api/drives/:driveId/jd`
- **Role:** All authenticated roles.
- **Response (`200 OK`):** Binary PDF download with `Content-Disposition: attachment`.

### 2.5. `PATCH /api/drives/:driveId/applications/:studentId/rounds`
- **Role:** `MAIN_COORDINATOR`, `BRANCH_COORDINATOR` (own branch).
- **Body:** `{ roundNumber?: number, result?: 'SHORTLISTED' | 'REJECTED', placed?: boolean }`.
- **Constraints:**
  - Round $N$ can only be `'SHORTLISTED'` if Round $N-1$ was `'SHORTLISTED'`.
  - `roundNumber <= drive.totalRounds`.
- **Response (`200 OK`):** Updated placement status and round results array.

### 2.6. `GET /api/drives/:driveId/stats`
- **Role:** `MAIN_COORDINATOR`, `BRANCH_COORDINATOR` (branch scoped).
- **Response (`200 OK`):**
  ```json
  {
    "branches": [
      {
        "branch": "CSE",
        "applied": 15,
        "shortlistedByRound": [10, 5, 2],
        "placed": 2
      }
    ],
    "totals": {
      "applied": 15,
      "shortlistedByRound": [10, 5, 2],
      "placed": 2
    }
  }
  ```

### 2.7. `GET /api/drives/:driveId/export`
- **Role:** `MAIN_COORDINATOR` (all branches), `BRANCH_COORDINATOR` (own branch). `STUDENT` receives `403 FORBIDDEN`.
- **Response (`200 OK`):** Excel `.xlsx` workbook binary with:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="${company}_Candidates.xlsx"`

---

## 3. Test Suite Summary

The test suite in `src/server/modules/drives/drives.routes.test.ts` (20 tests) and `drives.service.test.ts` (11 tests) covers:
- Complete parameter matrix for `evaluateEligibility`.
- Rejection of student and branch coordinator drive creation (`403`).
- Rejection of past deadlines and non-PDF JD uploads (`400`).
- Round progression constraint: cannot shortlist Round 2 without Round 1 (`400 VALIDATION_ERROR`).
- Multi-round progression sequence and placement updates.
- Branch coordinator isolation on round updates and stats queries.
- SQL `GROUP BY` aggregations matching seeded test data.
- Two-sheet Excel parsing: verifying sheet names, exclusion of unverified candidates, totals row calculation accuracy, and CSV/Excel formula injection neutralization (`'=HYPERLINK(...)`).
- Branch coordinator export isolation (contains only their branch).
- Student export rejection with `403 FORBIDDEN`.
