/**
 * @fileoverview Job Description (JD) AI analysis and summarization service.
 * Uses Gemini Interactions API to extract company, role, package categories (General <7 LPA, Dream >=7 LPA, Internship),
 * eligibility criteria, backlog/supply allowance, and eligible branches.
 * @module server/modules/drives/jd-summarizer.service
 */

import { GoogleGenAI } from '@google/genai';
import { env } from '@/server/config/env';

export interface JdSummaryResult {
  company: string;
  role: string;
  summary: string;
  packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  ctcLpa: number | null;
  minCgpa: number;
  allowBacklogs: boolean;
  maxActiveBacklogs: number;
  eligibleBranches: string[];
}

/**
 * Extracts visible text strings from a binary buffer (simple ASCII / UTF-8 extractor for PDF text streams).
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Simple heuristic text extractor from PDF buffer stream
  const content = buffer.toString('latin1');
  const textChunks: string[] = [];
  
  // Extract text within BT ... ET blocks or string literals ( ... )
  const stringLiteralRegex = /\(([^()]{3,})\)/g;
  let match: RegExpExecArray | null;
  while ((match = stringLiteralRegex.exec(content)) !== null) {
    const cleaned = match[1].replace(/\\[nrtbf\\]/g, ' ').trim();
    if (cleaned.length > 2 && /[a-zA-Z0-9]/.test(cleaned)) {
      textChunks.push(cleaned);
    }
  }

  if (textChunks.length > 5) {
    return textChunks.join(' ');
  }

  // Fallback: extract printable ASCII sequences
  const asciiMatches = content.match(/[A-Za-z0-9\s.,:;/@()\-–—]{4,}/g);
  return asciiMatches ? asciiMatches.join(' ') : buffer.toString('utf-8');
}

/**
 * Deterministic fallback heuristic parser when AI is unavailable or fails.
 */
export function parseJdDeterministically(text: string): JdSummaryResult {
  const lower = text.toLowerCase();

  // 1. Detect Company
  let company = 'Recruitment Partner';
  const companyMatch = text.match(/(?:company|organization|employer|client)\s*[:\-–]\s*([A-Za-z0-9&. \t]{2,40})/i) ||
                       text.match(/(?:welcome to|hiring at|careers at)\s+([A-Za-z0-9&. \t]{2,35})/i);
  if (companyMatch && companyMatch[1].trim()) {
    company = companyMatch[1].trim().split('\n')[0].trim();
  } else {
    const firstLines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (firstLines.length > 0 && firstLines[0].length < 40) {
      company = firstLines[0];
    }
  }

  // 2. Detect Role / Title
  let role = 'Software Engineer';
  const roleMatch = text.match(/(?:role|designation|position|job title|profile)\s*[:\-–]\s*([A-Za-z0-9/().\- \t]{2,40})/i) ||
                    text.match(/(?:hiring for|seeking a|opening for)\s+([A-Za-z0-9/().\- \t]{2,35})/i);
  if (roleMatch && roleMatch[1].trim()) {
    role = roleMatch[1].trim().split('\n')[0].trim();
  }

  // 3. Detect CTC / Compensation
  let ctcLpa: number | null = null;
  let packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP' = 'GENERAL';

  const isInternship = lower.includes('intern') || lower.includes('stipend') || lower.includes('internship');

  const ctcMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lakh|lac|per annum)/i) ||
                   text.match(/inr\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakh)/i) ||
                   text.match(/ctc\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i);

  if (ctcMatch) {
    ctcLpa = parseFloat(ctcMatch[1]);
  }

  if (isInternship && (!ctcLpa || ctcLpa < 4)) {
    packageCategory = 'INTERNSHIP';
  } else if (ctcLpa !== null) {
    packageCategory = ctcLpa >= 7.0 ? 'DREAM' : 'GENERAL';
  } else {
    packageCategory = 'GENERAL';
  }

  // 4. Detect Minimum CGPA
  let minCgpa = 6.0;
  const cgpaMatch = text.match(/(?:cgpa|gpa|pointer)\s*(?:>=|:|of|above|minimum|min)?\s*(\d+(?:\.\d+)?)/i) ||
                    text.match(/(\d+(?:\.\d+)?)\s*(?:cgpa|gpa)/i);
  if (cgpaMatch) {
    const val = parseFloat(cgpaMatch[1]);
    if (val >= 0 && val <= 10) {
      minCgpa = val;
    }
  }

  // 5. Detect Backlogs / Supply Allowance
  let allowBacklogs = false;
  if (
    lower.includes('no backlogs') ||
    lower.includes('0 backlogs') ||
    lower.includes('zero backlogs') ||
    lower.includes('no active backlogs') ||
    lower.includes('no standing arrears') ||
    lower.includes('without backlogs') ||
    lower.includes('cleared all backlogs')
  ) {
    allowBacklogs = false;
  } else if (
    lower.includes('backlogs allowed') ||
    lower.includes('active backlogs permitted') ||
    lower.includes('with backlogs') ||
    lower.includes('supply allowed')
  ) {
    allowBacklogs = true;
  }

  // 6. Detect Eligible Branches
  const detectedBranches = new Set<string>();
  const branchKeywords: Record<string, RegExp> = {
    CSE: /\b(?:cse|computer science|computer engineering|information technology|cs)\b/i,
    IT: /\b(?:it|information technology)\b/i,
    ECE: /\b(?:ece|electronics|telecommunication)\b/i,
    EEE: /\b(?:eee|ee|electrical)\b/i,
    CIVIL: /\b(?:civil)\b/i,
    MCA: /\b(?:mca|master of computer applications)\b/i,
    MECH: /\b(?:mech|mechanical)\b/i,
    AIDS: /\b(?:ai|data science|ai&ds|aids)\b/i,
  };

  for (const [branch, regex] of Object.entries(branchKeywords)) {
    if (regex.test(text)) {
      detectedBranches.add(branch);
    }
  }

  const eligibleBranches = detectedBranches.size > 0
    ? Array.from(detectedBranches)
    : ['CSE', 'IT', 'ECE'];

  const summary = `${company} is recruiting for ${role} with a compensation package categorized under ${packageCategory}${ctcLpa ? ` (${ctcLpa} LPA)` : ''}. Eligibility requires a minimum CGPA of ${minCgpa} across ${eligibleBranches.join(', ')} with ${allowBacklogs ? 'active supply/backlogs permitted' : 'no active backlogs'}.`;

  return {
    company,
    role,
    summary,
    packageCategory,
    ctcLpa,
    minCgpa,
    allowBacklogs,
    maxActiveBacklogs: allowBacklogs ? 2 : 0,
    eligibleBranches,
  };
}

export interface UploadedFileDoc {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
}

/**
 * Summarizes Job Description PDFs or text (supporting multiple PDF documents e.g. JD, assessment syllabus, guidelines),
 * classifying into General (<7 LPA), Dream (>=7 LPA), or Internship, with CGPA criteria and backlog eligibility.
 */
export async function summarizeJobDescription(params: {
  buffer?: Buffer;
  mimetype?: string;
  text?: string;
  files?: UploadedFileDoc[];
}): Promise<JdSummaryResult> {
  const fileList: UploadedFileDoc[] = [];
  if (params.files && params.files.length > 0) {
    fileList.push(...params.files);
  } else if (params.buffer) {
    fileList.push({
      buffer: params.buffer,
      mimetype: params.mimetype,
      originalname: 'document.pdf',
    });
  }

  const textChunks: string[] = [];
  if (params.text?.trim()) {
    textChunks.push(params.text.trim());
  }

  for (const f of fileList) {
    const docName = f.originalname || 'Document';
    const extracted = extractTextFromPdfBuffer(f.buffer);
    textChunks.push(`=== Document: ${docName} ===\n${extracted}`);
  }

  const combinedText = textChunks.join('\n\n');

  // Attempt AI processing with Gemini if credentials exist
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (apiKey && (fileList.length > 0 || combinedText)) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const model = env.MAPPING_MODEL || process.env.MAPPING_MODEL || 'gemini-2.5-flash';

      const promptInstructions = `
You are an expert college placement director.
Analyze this recruitment Job Description (JD) and any accompanying documents (e.g. guidelines, assessment pattern, company profile) and return ONLY a valid JSON object with the exact keys:
{
  "company": "Company Name",
  "role": "Job Role / Title",
  "summary": "2-3 sentence overview of company, role, responsibilities and key requirements synthesized across all provided documents",
  "packageCategory": "GENERAL" or "DREAM" or "INTERNSHIP",
  "ctcLpa": numeric compensation in LPA (e.g. 8.5) or null,
  "minCgpa": numeric minimum CGPA (0-10) or 0 if not specified,
  "allowBacklogs": boolean (true if active backlogs/supply/arrears are explicitly allowed, false if zero backlogs required),
  "eligibleBranches": array of uppercase department codes from ["CSE", "ECE", "EEE", "IT", "CIVIL", "MCA", "MECH", "AIDS"]
}

Package Category Classification Rules:
- If CTC is 7.0 LPA or higher (>= 7 LPA): "packageCategory" MUST be "DREAM"
- If CTC is less than 7.0 LPA (< 7 LPA): "packageCategory" MUST be "GENERAL"
- If it is an internship with stipend: "packageCategory" MUST be "INTERNSHIP"

Provide pure JSON only.`;

      const parts: any[] = [];
      const pdfFiles = fileList.filter((f) => f.mimetype === 'application/pdf');
      // Pass up to 5 PDFs as inline data
      for (const pdf of pdfFiles.slice(0, 5)) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: pdf.buffer.toString('base64'),
          },
        });
      }

      parts.push({
        text: `${promptInstructions}\n\nAll Uploaded Documents Content:\n${combinedText.slice(0, 15000)}`,
      });

      const contents = [
        {
          role: 'user',
          parts,
        },
      ];

      const response = await ai.models.generateContent({
        model,
        contents,
      });

      const responseText = response.text?.trim() || '';
      const cleanJson = responseText.replace(/^```json/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      const ctc = typeof parsed.ctcLpa === 'number' ? parsed.ctcLpa : null;
      let category = (parsed.packageCategory || '').toUpperCase() as 'GENERAL' | 'DREAM' | 'INTERNSHIP';
      if (!['GENERAL', 'DREAM', 'INTERNSHIP'].includes(category)) {
        if (ctc && ctc >= 7.0) category = 'DREAM';
        else category = 'GENERAL';
      }

      return {
        company: parsed.company || 'Recruitment Company',
        role: parsed.role || 'Software Engineer',
        summary: parsed.summary || `${parsed.company} is hiring for ${parsed.role}.`,
        packageCategory: category,
        ctcLpa: ctc,
        minCgpa: typeof parsed.minCgpa === 'number' ? parsed.minCgpa : 6.0,
        allowBacklogs: Boolean(parsed.allowBacklogs),
        maxActiveBacklogs: parsed.allowBacklogs ? 2 : 0,
        eligibleBranches: Array.isArray(parsed.eligibleBranches) && parsed.eligibleBranches.length > 0
          ? parsed.eligibleBranches.map((b: string) => b.toUpperCase())
          : ['CSE', 'IT', 'ECE'],
      };
    } catch {
      // AI call or parsing failed; fallback gracefully to deterministic heuristic parser
    }
  }

  // Graceful deterministic heuristic fallback
  return parseJdDeterministically(combinedText);
}

