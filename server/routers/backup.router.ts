import { router, licenseProtectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { BackupService } from "../services/backup.service";

export const backupRouter = router({
    listBackups: licenseProtectedProcedure.query(async () => {
        return BackupService.getBackups();
    }),

    createBackup: licenseProtectedProcedure.mutation(async () => {
        return await BackupService.createBackup();
    }),

    restoreBackup: licenseProtectedProcedure
        .input(z.object({ filename: z.string() }))
        .mutation(async ({ input }) => {
            const success = await BackupService.restoreBackup(input.filename);
            return { status: success ? "restored" : "failed", filename: input.filename };
        }),

    deleteBackup: licenseProtectedProcedure
        .input(z.object({ filename: z.string() }))
        .mutation(async ({ input }) => {
            const success = await BackupService.deleteBackup(input.filename);
            return { status: success ? "deleted" : "failed" };
        }),
});
