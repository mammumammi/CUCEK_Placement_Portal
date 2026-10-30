# Module Specification: Bulk Student Registration (`registration`)

> **Module Path:** `src/server/modules/registration/`  
> **Mounted At:** `/api/registration`  
> **Input Format:** Microsoft Excel OpenXML Spreadsheet (`.xlsx`, 5MB max)

---

## 1. Overview & Data Flow

The `registration` module ingests student batches from coordinator-uploaded `.xlsx` spreadsheets. It implements a two-phase commit pattern:
1. **Preview Phase (`/api/registration/preview`):** Parses and validates sheet data, detects duplicate records (both internally and against the existing database), computes student CGPA, and checks coordinator branch permissions without writing to the database or hashing passwords.
2. **Commit Phase (`/api/registration/commit`):** Re-parses and re-validates the spreadsheet on the server, precomputes scrypt password hashes asynchronously, and atomically commits records into `users`, `student_profiles`, and `semester_results` inside a single database transaction.

---

## 2. Spreadsheet Column Specifications

Parsed from the first row (case-insensitive, whitespace-trimmed) using `COLUMN_MAP`:

| Canonical Field | Expected Header Name | Constraints / Format |
| :--- | :--- | :--- |
| `studentId` | `studentId`, `student id` | Required, non-empty, unique college roll number |
| `name` | `name`, `student name` | Required, non-empty string |
| `branch` | `branch`, `department` | Required, non-empty string |
| `batch` | `batch` | Required, non-empty cohort string (e.g. `'2022-2026'`) |
| `email` | `email`, `email address` | Required, valid email address |
| `phone` | `phone`, `phone number` | Required, strictly 10 digits (`^\d{10}$`) |
| `activeBacklogs`| `activeBacklogs`, `backlogs` | Required, non-negative integer ($\ge 0$) |
| `s1Sgpa`..`s6Sgpa` | `s1Sgpa`..`s6Sgpa` | Numeric $[0.00, 10.00]$, must pair with credits |
| `s1Credits`..`s6Credits` | `s1Credits`..`s6Credits` | Integer $> 0$, must pair with SGPA |

> **Semester Pairing Invariant:** For every semester $1 \le i \le 6$, `s{i}Sgpa` and `s{i}Credits` must **both be populated** or **both remain blank**.

---

## 3. API Endpoints

### 3.1. `POST /api/registration/preview`
- **Access Control:** `MAIN_COORDINATOR`, and `BRANCH_COORDINATOR` (restricted to rows matching their own `branch`).
- **Content-Type:** `multipart/form-data` with file field `"file"`.
- **Response (`200 OK`):**
  ```json
  {
    "rows": [
      {
        "rowNumber": 2,
        "data": { "studentId": "2022BCSE001", "name": "Alice", ... },
        "cgpa": 8.76,
        "errors": []
      }
    ],
    "summary": {
      "total": 1,
      "valid": 1,
      "invalid": 0,
      "duplicatesInFile": 0,
      "duplicatesInDb": 0
    }
  }
  ```

### 3.2. `POST /api/registration/commit`
- **Access Control:** `MAIN_COORDINATOR`, and `BRANCH_COORDINATOR` (restricted to their own branch).
- **Query Parameters:** `?skipInvalid=true` (optional).
  - If `false` (default): Rejects the whole commit with `400 VALIDATION_ERROR` if any row has errors.
  - If `true`: Commits valid rows and skips invalid ones.
- **Transaction Details:**
  1. Creates user: `username = studentId`, `passwordHash = scrypt(studentId)`, `role = STUDENT`.
  2. Creates profile: `student_profiles` populated with student details and computed `cgpa`.
  3. Creates semester results: inserts populated `semester_results` (1–6).
- **Response (`200 OK`):**
  ```json
  {
    "created": 1,
    "skipped": 0
  }
  ```

---

## 4. Frontend Client Service

Located in [`src/services/registration.service.ts`](file:///Users/mammu/CodeWorks/WebDevelopmentprojects/IT_Minor_Project/placement_portal/src/services/registration.service.ts):

```typescript
import { apiClient } from '@/lib/api-client';

export async function previewBulkRegistration(file: File): Promise<PreviewResponse>;
export async function commitBulkRegistration(file: File, opts?: { skipInvalid?: boolean }): Promise<CommitResponse>;
```
- Sets explicit `'Content-Type': 'multipart/form-data'` on `FormData` calls, overriding the default JSON Content-Type header on `apiClient`.

