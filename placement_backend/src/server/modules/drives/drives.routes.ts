/**
 * @fileoverview Recruitment drives Express routes.
 * @module server/modules/drives/drives.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { PortalError } from '@/core/errors/portal-error';
import { eq, desc } from 'drizzle-orm';
import { drives, applications, studentProfiles } from '@/core/db';
import { defaultStorage } from '@/server/services/storage.service';
import type { FileStorage } from '@/server/services/storage.service';
import { createDriveSchema, updateRoundSchema, driveExtraFieldSchema, updateDriveDetailsSchema } from './drives.schema';
import {
  createDrive,
  listDrives,
  getDriveById,
  getDriveJdFile,
  updateApplicationRound,
  getDriveStats,
  updateDriveDetails,
  deleteDrive,
} from './drives.service';
import {
  buildDriveExportWorkbook,
  buildCompanyFormatWorkbook,
  parseCompanyTemplateBuffer,
  buildComprehensiveStatisticsWorkbook,
  saveReferenceStatsTemplate,
  getReferenceStatsTemplateStatus,
  getReferenceStatsTemplateBuffer,
  deleteReferenceStatsTemplate,
} from './export.service';
import { summarizeJobDescription } from './jd-summarizer.service';
import { notifyEligibleStudentsForDrive } from './mail.service';
import { generateDriveMockOA } from '../assessments/assessments.service';
import {
  parseShortlistPdfAndMatch,
  confirmShortlistAndNotify,
} from './shortlist.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = file.originalname.toLowerCase();
    const isPdf =
      file.mimetype === 'application/pdf' ||
      lowerName.endsWith('.pdf');
    const isExcel =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls');

    if (isPdf || isExcel) {
      cb(null, true);
    } else {
      cb(
        new PortalError(
          'VALIDATION_ERROR',
          'Only PDF files are supported for Job Description (JD), and Excel (.xlsx, .xls) files are supported for company templates',
          400
        )
      );
    }
  },
});

/**
 * Creates the drives module Express router.
 *
 * @param db - The injected database instance.
 * @param storage - Optional FileStorage implementation (defaults to LocalDiskStorage).
 * @returns Configured Express Router mounted under /api/drives.
 */
export function createDrivesRouter(
  db: Db,
  storage: FileStorage = defaultStorage
): Router {
  const router = Router();

  // POST /api/drives (MAIN_COORDINATOR, multipart JD PDF upload)
  router.post(
    '/',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    (req: Request, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err: unknown) => {
        if (err) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: unknown }).code === 'LIMIT_FILE_SIZE'
          ) {
            return next(
              new PortalError(
                'VALIDATION_ERROR',
                'File size exceeds maximum limit of 10MB',
                400
              )
            );
          }
          return next(err);
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createDriveSchema.parse(req.body);
        const uploadedFiles: Express.Multer.File[] = [];
        if (req.file) {
          uploadedFiles.push(req.file);
        } else if (Array.isArray(req.files) && req.files.length > 0) {
          uploadedFiles.push(...(req.files as Express.Multer.File[]));
        }

        const created = await createDrive(
          db,
          storage,
          req.user!,
          input,
          uploadedFiles.length > 0 ? uploadedFiles : undefined
        );

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/summarize-jd (JD PDF(s) or text summarizer using Gemini AI)
  router.post(
    '/summarize-jd',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    (req: Request, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err: unknown) => {
        if (err) return next(err);
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const uploadedFiles: Express.Multer.File[] = [];
        if (req.file) {
          uploadedFiles.push(req.file);
        } else if (Array.isArray(req.files) && req.files.length > 0) {
          uploadedFiles.push(...(req.files as Express.Multer.File[]));
        }

        const text = typeof req.body.text === 'string' ? req.body.text : undefined;

        if (uploadedFiles.length === 0 && !text) {
          throw new PortalError('VALIDATION_ERROR', 'Please provide at least one JD PDF file or text content', 400);
        }

        const summary = await summarizeJobDescription({
          buffer: uploadedFiles[0]?.buffer,
          mimetype: uploadedFiles[0]?.mimetype,
          text,
          files: uploadedFiles.map((f) => ({
            buffer: f.buffer,
            mimetype: f.mimetype,
            originalname: f.originalname,
          })),
        });

        res.status(200).json(summary);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/parse-company-template (Upload company Excel template to extract required headers & auto-map)
  router.post(
    '/parse-company-template',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    (req: Request, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err: unknown) => {
        if (err) return next(err);
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file =
          req.file ??
          (Array.isArray(req.files) && req.files.length > 0
            ? (req.files[0] as Express.Multer.File)
            : undefined);

        if (!file) {
          throw new PortalError('VALIDATION_ERROR', 'Please upload a company Excel template (.xlsx)', 400);
        }

        const parsed = await parseCompanyTemplateBuffer(file.buffer);
        res.status(200).json(parsed);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/:driveId/notify (Send broadcast email to all eligible students with sheet link)
  router.post(
    '/:driveId/notify',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const baseUrl = req.body.baseUrl || `${req.protocol}://${req.get('host')}`.replace(':4000', ':3000');
        const result = await notifyEligibleStudentsForDrive(db, driveId, baseUrl);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/public-stats (Public placement highlights & department statistics)
  router.get('/public-stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const allProfiles = await db.select().from(studentProfiles);
      const totalStudents = allProfiles.length;

      const placedApps = await db
        .select({
          studentUserId: applications.studentUserId,
          driveId: applications.driveId,
          company: drives.company,
          role: drives.role,
          ctcLpa: drives.ctcLpa,
        })
        .from(applications)
        .innerJoin(drives, eq(applications.driveId, drives.id))
        .where(eq(applications.placed, true));

      const placedStudentUserIds = new Set(placedApps.map((p) => p.studentUserId));
      const totalPlaced = placedStudentUserIds.size;
      const placementRate = totalStudents > 0 ? Number(((totalPlaced / totalStudents) * 100).toFixed(1)) : 0;

      const validCtcs = placedApps.map((p) => p.ctcLpa).filter((c): c is number => typeof c === 'number' && c > 0);
      const highestPackage = validCtcs.length > 0 ? Math.max(...validCtcs) : 0;
      const averagePackage = validCtcs.length > 0 ? Number((validCtcs.reduce((a, b) => a + b, 0) / validCtcs.length).toFixed(1)) : 0;

      const allDrives = await db.select().from(drives).orderBy(desc(drives.createdAt));
      const featuredDrives = allDrives.slice(0, 6).map((d) => ({
        id: d.id,
        company: d.company,
        role: d.role,
        packageCategory: d.packageCategory,
        ctcLpa: d.ctcLpa,
        deadline: d.deadline,
        eligibleBranches: d.eligibleBranches,
        open: new Date(d.deadline).getTime() > Date.now(),
      }));

      const branches = ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'];
      const branchBreakdown = branches.map((b) => {
        const branchProfs = allProfiles.filter((p) => p.branch === b);
        const branchUserIds = new Set(branchProfs.map((p) => p.userId));
        const branchPlaced = placedApps.filter((p) => branchUserIds.has(p.studentUserId));
        const branchPlacedCount = new Set(branchPlaced.map((p) => p.studentUserId)).size;
        const bRate = branchProfs.length > 0 ? Number(((branchPlacedCount / branchProfs.length) * 100).toFixed(1)) : 0;
        return {
          branch: b,
          total: branchProfs.length,
          placed: branchPlacedCount,
          placementRate: bRate,
        };
      });

      const topCompanies = Array.from(new Set(placedApps.map((p) => p.company))).filter(Boolean);

      res.status(200).json({
        totalStudents,
        totalPlaced,
        placementRate,
        highestPackage,
        averagePackage,
        totalDrives: allDrives.length,
        branchBreakdown,
        topCompanies,
        featuredDrives,
      });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // SUPER ADMIN COMPREHENSIVE PLACEMENT & DEPARTMENT STATISTICS EXCEL ROUTES
  // =========================================================================

  // GET /api/drives/statistics/template-status (Super Admin checks if a reference template has been uploaded)
  router.get(
    '/statistics/template-status',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const status = await getReferenceStatsTemplateStatus();
        res.status(200).json(status);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/statistics/template (Super Admin uploads a reference Excel template)
  router.post(
    '/statistics/template',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    upload.single('template'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = req.file;
        if (!file) {
          throw new PortalError('VALIDATION_ERROR', 'No Excel template file was uploaded. Please attach a .xlsx or .xls file.', 400);
        }

        const meta = await saveReferenceStatsTemplate(file.buffer, file.originalname);
        res.status(201).json({
          success: true,
          message: `Reference template "${meta.filename}" saved successfully with sheets: ${meta.sheetNames.join(', ')}`,
          ...meta,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/statistics/download-template (Super Admin downloads the current reference template)
  router.get(
    '/statistics/download-template',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tpl = await getReferenceStatsTemplateBuffer();
        if (!tpl) {
          throw new PortalError('NOT_FOUND', 'No custom reference template has been uploaded yet', 404);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
        res.status(200).send(tpl.buffer);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/drives/statistics/template (Super Admin resets / clears reference template)
  router.delete(
    '/statistics/template',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteReferenceStatsTemplate();
        res.status(200).json({ success: true, message: 'Reference template removed successfully' });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/statistics/export-excel (Super Admin generates multi-sheet placement & department statistics Excel)
  router.get(
    '/statistics/export-excel',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tpl = await getReferenceStatsTemplateBuffer();
        const workbook = await buildComprehensiveStatisticsWorkbook(db, tpl?.buffer);
        const buffer = await workbook.xlsx.writeBuffer();

        const filename = `University_Placement_Statistics_Report_${new Date().getFullYear()}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(Buffer.from(buffer));
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/drives/:driveId/extra-fields (Coordinators can add/update dynamic batch info collection fields)
  router.patch(
    '/:driveId/extra-fields',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId) ? req.params.driveId[0] : req.params.driveId;
        const [drive] = await db.select().from(drives).where(eq(drives.id, driveId)).limit(1);
        if (!drive) {
          throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
        }

        const existingFields: any[] = Array.isArray(drive.extraFields) ? [...drive.extraFields] : [];
        let updatedFields = [...existingFields];

        if (req.body.extraFields && Array.isArray(req.body.extraFields)) {
          updatedFields = req.body.extraFields;
        } else if (req.body.newField && typeof req.body.newField === 'object') {
          const field = driveExtraFieldSchema.parse(req.body.newField);
          const idx = updatedFields.findIndex((f) => f.key === field.key);
          if (idx >= 0) {
            updatedFields[idx] = field;
          } else {
            updatedFields.push(field);
          }
        }

        await db.update(drives).set({ extraFields: updatedFields }).where(eq(drives.id, driveId));
        res.status(200).json({ driveId, extraFields: updatedFields });
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/drives/:driveId/details (Coordinators: update YouTube link, role, category, criteria)
  router.patch(
    '/:driveId/details',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId) ? req.params.driveId[0] : req.params.driveId;
        const body = updateDriveDetailsSchema.parse(req.body);
        const updated = await updateDriveDetails(db, req.user!, driveId, body);
        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/drives/:driveId (Super Admin takes down / deletes a recruitment drive)
  router.delete(
    '/:driveId',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId) ? req.params.driveId[0] : req.params.driveId;
        const result = await deleteDrive(db, req.user!, driveId);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives (All authenticated roles; includes open, and eligible+reasons for students)
  router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const drivesList = await listDrives(db, req.user!);
        res.status(200).json(drivesList);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/jd (Download JD PDF)
  router.get(
    '/:driveId/jd',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const { drive, file } = await getDriveJdFile(db, storage, driveId);

        const safeCompany = drive.company.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', file.contentType || 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeCompany}_JD.pdf"`
        );
        res.status(200).send(file.data);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/stats (Coordinators; branch coordinators see only own branch)
  router.get(
    '/:driveId/stats',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const stats = await getDriveStats(db, driveId, req.user!);
        res.status(200).json(stats);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/export (Generate Excel report: verified candidates + summary, or company format via ?format=company)
  router.get(
    '/:driveId/export',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const [drive] = await db
          .select()
          .from(drives)
          .where(eq(drives.id, driveId))
          .limit(1);

        if (!drive) {
          throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
        }

        const isCompanyFormat = req.query.format === 'company';
        const workbook = isCompanyFormat
          ? await buildCompanyFormatWorkbook(db, driveId, req.user!)
          : await buildDriveExportWorkbook(db, driveId, req.user!);

        const buffer = await workbook.xlsx.writeBuffer();

        const safeCompany = drive.company.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = isCompanyFormat
          ? `${safeCompany}_Company_Format_Candidates.xlsx`
          : `${safeCompany}_Candidates.xlsx`;

        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );
        res.status(200).send(Buffer.from(buffer));
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/export-company (Generate Excel formatted specifically to company required headers)
  router.get(
    '/:driveId/export-company',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const [drive] = await db
          .select()
          .from(drives)
          .where(eq(drives.id, driveId))
          .limit(1);

        if (!drive) {
          throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
        }

        const workbook = await buildCompanyFormatWorkbook(db, driveId, req.user!);
        const buffer = await workbook.xlsx.writeBuffer();

        const safeCompany = drive.company.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeCompany}_Company_Format_Candidates.xlsx"`
        );
        res.status(200).send(Buffer.from(buffer));
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/drives/:driveId/applications/:studentId/rounds (Coordinators only; branch scoped)
  router.patch(
    '/:driveId/applications/:studentId/rounds',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;

        const body = updateRoundSchema.parse(req.body);
        const result = await updateApplicationRound(
          db,
          req.user!,
          driveId,
          studentId,
          body
        );

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId (Single drive details with open and eligible status)
  router.get(
    '/:driveId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const drive = await getDriveById(db, req.user!, driveId);
        res.status(200).json(drive);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/:driveId/mock-test-pdf (Super Admin uploads mock test reference PDF for a drive)
  router.post(
    '/:driveId/mock-test-pdf',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    (req: Request, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err: unknown) => {
        if (err) return next(err);
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const [drive] = await db
          .select()
          .from(drives)
          .where(eq(drives.id, driveId))
          .limit(1);

        if (!drive) {
          throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
        }

        const uploadedFiles: Express.Multer.File[] = [];
        if (req.file) {
          uploadedFiles.push(req.file);
        } else if (Array.isArray(req.files) && req.files.length > 0) {
          uploadedFiles.push(...(req.files as Express.Multer.File[]));
        }

        if (uploadedFiles.length === 0) {
          throw new PortalError('VALIDATION_ERROR', 'No mock test PDF uploaded', 400);
        }

        const newPdfUrls: string[] = [];
        for (const f of uploadedFiles) {
          const saved = await storage.save(f.originalname, f.buffer, f.mimetype);
          newPdfUrls.push(saved.url);
        }

        const existingUrls = drive.mockTestPdfUrls || [];
        const mergedUrls = Array.from(new Set([...existingUrls, ...newPdfUrls]));

        await db
          .update(drives)
          .set({ mockTestPdfUrls: mergedUrls })
          .where(eq(drives.id, driveId));

        // Trigger multi-agent regeneration to synthesize from the new mock test PDF
        await generateDriveMockOA(db, driveId, { force: true });

        res.status(200).json({
          success: true,
          message: `Mock test PDF attached and multi-agent assessment synthesized (${newPdfUrls.length} file(s)).`,
          mockTestPdfUrls: mergedUrls,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/:driveId/shortlist/parse-pdf (Coordinators upload shortlisted candidate PDF & match DB students)
  router.post(
    '/:driveId/shortlist/parse-pdf',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = String(req.params.driveId);
        const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : undefined;
        const result = await parseShortlistPdfAndMatch(db, req.user!, driveId, {
          pdfBuffer: req.file?.buffer,
          rawText,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/drives/:driveId/shortlist/notify (Coordinators confirm shortlisted students & notify in portal)
  router.post(
    '/:driveId/shortlist/notify',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = String(req.params.driveId);
        const { studentUserIds, roundNumber, roundName, markAsPlaced } = req.body || {};
        const result = await confirmShortlistAndNotify(db, req.user!, driveId, {
          studentUserIds: Array.isArray(studentUserIds) ? studentUserIds : [],
          roundNumber: Number(roundNumber) || 1,
          roundName: typeof roundName === 'string' ? roundName : undefined,
          markAsPlaced: Boolean(markAsPlaced),
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

