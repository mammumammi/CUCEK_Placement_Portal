# 💻 CUCEK Placement Portal — Frontend Application

This directory contains the Next.js 16 + React 19 frontend application for the **CUCEK Placement Portal**.

For the complete technical architecture, Big Data Analytics pipeline, Multi-Agent OA Engine, and backend documentation, please refer to the [Root README](../README.md).

---

## 🚀 Key Frontend Features

- **Next.js 16 App Router & React 19**: Server and client component architecture with Turbopack for near-instant hot reloads.
- **Tailwind CSS v4**: Modern, responsive dark-mode first design utilizing the latest Tailwind CSS v4 engine.
- **Interactive Mock OA Simulator**: 
  - Dynamic 90-minute testing environment with real-time countdown timer.
  - In-browser code editor with polyglot execution support (JavaScript, Python 3, Java, C++).
  - Multi-discipline MCQ assessment module (Quantitative Aptitude, Logical Reasoning, Core CS).
  - Real-time cloud execution telemetry and cohort runtime bell curves.
- **Role-Based Portals**:
  - **Student Dashboard** (`/drives`, `/drives/[driveId]`): Drive browsing, eligibility status, 1-click applications.
  - **Coordinator Dashboard** (`/coordinator`): Drive creation, applicant verification, status tracking.
  - **Super Admin Dashboard** (`/admin`): Departmental placement statistics, manual placement tagging, reference format uploading, and multi-sheet Excel generation.
- **Resilient Dual-Mode Authentication**: Automatically supports both SameSite cookies and local storage Bearer token dispatch, eliminating cross-origin lockouts on Brave and Safari.

---

## 🛠️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env.local` file in this directory (or rely on default fallback to the deployed backend):
```env
NEXT_PUBLIC_API_URL=https://cucek-placement-portal.onrender.com/api
```
*(For local backend development, set `NEXT_PUBLIC_API_URL=http://localhost:4000/api`)*

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 📦 Build for Production

```bash
npm run build
npm run start
```
