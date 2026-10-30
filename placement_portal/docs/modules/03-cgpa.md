# Module Specification: Academic Performance & CGPA (`cgpa`)

> **Module Path:** `src/server/modules/cgpa/`  
> **Mounted At:** `/api/cgpa`  
> **Calculation Standard:** Credit-Weighted Cumulative Grade Point Average

---

## 1. Overview & Mathematical Definition

The `cgpa` module computes credit-weighted Cumulative Grade Point Average (CGPA) across student semester results, synchronizes values with the database, and provides evaluation entry points for drive eligibility.

### Mathematical Formulation
$$\text{CGPA} = \frac{\sum_{i=1}^{n} (\text{credits}_i \times \text{sgpa}_i)}{\sum_{i=1}^{n} \text{credits}_i}$$

### Calculation Rules
- **Decimal Precision:** Rounded to 2 decimal places using half-up precision.
- **Edge Conditions:** Returns `0.00` if the semester list is empty or the sum of credits is zero.
- **Input Validation:** Throws `VALIDATION_ERROR` if credits $< 0$ or SGPA is outside $[0.00, 10.00]$.

---

## 2. API Endpoints

### `POST /api/cgpa/calculate`
- **Access Control:** `requireAuth` (any authenticated role: `STUDENT`, `BRANCH_COORDINATOR`, `MAIN_COORDINATOR`).
- **Request Body:**
  ```json
  {
    "semesters": [
      { "semester": 1, "credits": 20, "sgpa": 8.0 },
      { "semester": 2, "credits": 22, "sgpa": 9.0 }
    ],
    "activeBacklogs": 1
  }
  ```
- **Response (`200 OK`):**
  ```json
  {
    "cgpa": 8.52,
    "activeBacklogs": 1
  }
  ```
- **Error Responses:**
  - `401 Unauthorized`: Missing or invalid session cookie (`UNAUTHORIZED`).
  - `400 Bad Request`: Payload validation failures (`VALIDATION_ERROR`).

---

## 3. Services & Public APIs

### `calculateCreditBasedCgpa(semesters)`
Pure calculation function computing the weighted CGPA:
```typescript
export function calculateCreditBasedCgpa(
  semesters: readonly { credits: number; sgpa: number }[]
): number
```

### `recalculateAndStoreCgpa(db, userId)`
Direct service called by other modules (e.g. semester marksheet ingestion, coordinator auditing):
```typescript
export async function recalculateAndStoreCgpa(
  db: Db,
  userId: string
): Promise<number>
```
1. Reads all records from `semester_results` where `userId = userId`.
2. Computes the credit-weighted CGPA using `calculateCreditBasedCgpa`.
3. Updates `student_profiles.cgpa` for the matching student record.
4. Returns the newly computed CGPA.

### `applyBacklogRule(cgpa, activeBacklogs)`
```typescript
export function applyBacklogRule(
  cgpa: number,
  activeBacklogs: number = 0
): { cgpa: number; eligible: boolean }
```
- **Current Status:** Placeholder returning `{ cgpa, eligible: true }`.
- **Note:** Real institutional penalty rules will be integrated once officially published by the college administration.

