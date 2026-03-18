/**
 * Backup Service 💾
 * 
 * application-level backup system that serializes database content to JSON keys.
 * preferred over pg_dump for portability and lack of external dependencies.
 */

import fs from 'fs';
import path from 'path';
import * as db from '../db';
import { logger } from '../_core/logger';
import { sql } from 'drizzle-orm';

const BACKUP_DIR = path.join(process.cwd(), "backups");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

export class BackupService {
    /**
     * Create a full database backup
     */
    static async createBackup(): Promise<{ filename: string; size: number; path: string }> {
        try {
            const database = await db.getDb();
            if (!database) throw new Error("Database not connected");

            logger.info('[Backup] Starting backup process...');

            // Fetch data from all critical tables
            const users = await database.select().from(db.users);
            const accounts = await database.select().from(db.telegramAccounts);
            const autoReplyRules = await database.select().from(db.autoReplyRules);
            const contentClonerRules = await database.select().from(db.contentClonerRules);
            const antiBanRules = await database.select().from(db.antiBanRules);
            const proxies = await database.select().from(db.proxyConfigs);
            const licenses = await database.select().from(db.licenses);
            const subscriptions = await database.select().from(db.subscriptions);

            // Optional: Backup heavy tables?
            // const members = await database.select().from(db.extractedMembers);

            const backupData = {
                metadata: {
                    version: '1.0',
                    timestamp: new Date().toISOString(),
                    stats: {
                        users: users.length,
                        accounts: accounts.length,
                        rules: autoReplyRules.length + contentClonerRules.length
                    }
                },
                data: {
                    users,
                    telegramAccounts: accounts,
                    autoReplyRules,
                    contentClonerRules,
                    antiBanRules,
                    proxyConfigs: proxies,
                    licenses,
                    subscriptions
                }
            };

            const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            const filepath = path.join(BACKUP_DIR, filename);

            fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
            const stats = fs.statSync(filepath);

            logger.info(`[Backup] Backup created: ${filename} (${stats.size} bytes)`);

            return {
                filename,
                size: stats.size,
                path: filepath
            };

        } catch (error: any) {
            logger.error('[Backup] Failed to create backup', { error: error.message });
            throw error;
        }
    }

    /**
     * Restore database from backup
     * WARNING: This is a destructive operation that replaces data (or conflicts)
     */
    static async restoreBackup(filename: string): Promise<boolean> {
        try {
            const filepath = path.join(BACKUP_DIR, filename);
            if (!fs.existsSync(filepath)) throw new Error("Backup file not found");

            const fileContent = fs.readFileSync(filepath, 'utf-8');
            const backup = JSON.parse(fileContent);

            if (!backup.data) throw new Error("Invalid backup format");

            const database = await db.getDb();
            if (!database) throw new Error("Database not connected");

            logger.info(`[Backup] Restoring from ${filename}...`);

            // Transactional restore
            await database.transaction(async (tx) => {
                // We can either:
                // 1. Truncate and insert (Clean restore)
                // 2. Upsert (Merge restore)

                // For safety and simplicity in "restore", we usually assume the user wants to go back to that state.
                // But deleting users might break current session.
                // Let's implement Upsert (do nothing on conflict) or flexible logic?
                // Actually, restore usually implies "reset to state".
                // Let's try to upsert for now to avoid FK constraint hell if we delete wrong things.

                // Users
                if (backup.data.users?.length) {
                    await tx.insert(db.users)
                        .values(backup.data.users.map((u: any) => ({
                            ...u,
                            createdAt: new Date(u.createdAt),
                            updatedAt: new Date(u.updatedAt)
                        })))
                        .onConflictDoNothing(); // Simple merge
                }

                // Licenses
                if (backup.data.licenses?.length) {
                    await tx.insert(db.licenses)
                        .values(backup.data.licenses.map((l: any) => ({
                            ...l,
                            createdAt: new Date(l.createdAt),
                            expiresAt: l.expiresAt ? new Date(l.expiresAt) : null,
                            activatedAt: l.activatedAt ? new Date(l.activatedAt) : null,
                        })))
                        .onConflictDoNothing();
                }

                // Telegram Accounts
                if (backup.data.telegramAccounts?.length) {
                    await tx.insert(db.telegramAccounts)
                        .values(backup.data.telegramAccounts.map((a: any) => ({
                            ...a,
                            createdAt: new Date(a.createdAt),
                            updatedAt: new Date(a.updatedAt),
                            lastActivityAt: a.lastActivityAt ? new Date(a.lastActivityAt) : null,
                        })))
                        .onConflictDoNothing();
                }

                // Rules
                if (backup.data.autoReplyRules?.length) {
                    await tx.insert(db.autoReplyRules)
                        .values(backup.data.autoReplyRules.map((r: any) => ({
                            ...r,
                            createdAt: new Date(r.createdAt),
                            updatedAt: new Date(r.updatedAt)
                        })))
                        .onConflictDoNothing();
                }

                if (backup.data.contentClonerRules?.length) {
                    await tx.insert(db.contentClonerRules)
                        .values(backup.data.contentClonerRules.map((r: any) => ({
                            ...r,
                            createdAt: new Date(r.createdAt),
                            updatedAt: new Date(r.updatedAt),
                            lastRunAt: r.lastRunAt ? new Date(r.lastRunAt) : null
                        })))
                        .onConflictDoNothing();
                }

                // Proxies
                if (backup.data.proxyConfigs?.length) {
                    await tx.insert(db.proxyConfigs)
                        .values(backup.data.proxyConfigs.map((p: any) => ({
                            ...p,
                            createdAt: new Date(p.createdAt),
                            updatedAt: new Date(p.updatedAt)
                        })))
                        .onConflictDoNothing();
                }
            });

            logger.info('[Backup] Restore completed successfully');
            return true;

        } catch (error: any) {
            logger.error('[Backup] Restore failed', { error: error.message });
            throw error;
        }
    }

    static getBackups() {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        return fs.readdirSync(BACKUP_DIR).map(f => {
            const stats = fs.statSync(path.join(BACKUP_DIR, f));
            return {
                filename: f,
                size: stats.size,
                createdAt: stats.birthtime
            };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    static deleteBackup(filename: string) {
        const filepath = path.join(BACKUP_DIR, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            return true;
        }
        return false;
    }
}
