/**
 * Startup Service 🚀
 * 
 * Orchestrates the initialization of all background services and listeners.
 */
import { telegramClientService } from './telegram-client.service';
import { autoReplyService } from './auto-reply.service';
import { contentClonerService } from './content-cloner.service';
import { logger } from '../_core/logger';
import * as db from '../db';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../_core/crypto';

export class StartupService {
    /**
     * Initialize all services
     */
    static async initializeAllServices() {
        logger.info('[Startup] Starting services initialization...');

        // 0. Integrity Check
        try {
            const { IntegrityChecker } = await import('../_core/integrity-checker');
            const isIntegrityOk = await IntegrityChecker.initialize();
            if (!isIntegrityOk) {
                logger.error('[Startup] Integrity check failed! Critical files tampered with.');
                // In production, we might want to exit here
            }
        } catch (e) {
            logger.warn('[Startup] Integrity checker not available or failed');
        }

        try {
            // 1. Ensure Admin exists (Self-Healing Admin) prince
            await this.ensureAdminExists();

            // 2. Connect all active Telegram accounts
            await this.connectActiveAccounts();

            // 3. Initialize Service Listeners
            await this.initializeServiceListeners();

            logger.info('[Startup] All services initialized successfully');
        } catch (error: any) {
            logger.error('[Startup] Initialization failed', { error: error.message });
        }
    }

    private static async ensureAdminExists() {
        const email = process.env.ADMIN_EMAIL || 'admin@falcon.pro';
        const password = process.env.ADMIN_PASSWORD || process.env.JWT_SECRET?.slice(0, 20) || 'secure_admin_password';
        const name = process.env.ADMIN_NAME || 'Falcon Admin';

        const database = await db.getDb();
        if (!database) return;

        const existing = await db.getUserByEmail(email);
        if (!existing) {
            logger.info(`[Startup] No admin found. Creating auto-admin: ${email}...`);
            await db.createUser({
                email,
                password: hashPassword(password),
                username: email.split('@')[0], // Use email prefix as username
                role: 'admin',
                isActive: true
            });
            logger.info('[Startup] Auto-Admin created successfully! 🛡️');
        } else {
            logger.info('[Startup] Admin check: OK.');
        }
    }

    private static async connectActiveAccounts() {
        logger.info('[Startup] Connecting active Telegram accounts...');
        const database = await db.getDb();
        if (!database) return;

        const accounts = await database.select().from(db.telegramAccounts).where(eq(db.telegramAccounts.isActive, true));

        for (const account of accounts) {
            try {
                logger.info(`[Startup] Initializing account ${account.id} (${account.phoneNumber})...`);
                await telegramClientService.initializeClient(
                    account.id,
                    account.phoneNumber,
                    account.sessionString
                );
                logger.info(`[Startup] ✅ Connected account ${account.id} (${account.phoneNumber})`);
            } catch (error: any) {
                logger.error(`[Startup] ❌ Failed to connect account ${account.id} (${account.phoneNumber}): ${error.message}`);
                // Continue to next account
            }
        }

        logger.info(`[Startup] Connected ${accounts.length} accounts`);
    }

    private static async initializeServiceListeners() {
        const database = await db.getDb();
        if (!database) return;

        // Auto Reply Listeners
        const replyRules = await database.select().from(db.autoReplyRules).where(eq(db.autoReplyRules.isActive, true));
        for (const rule of replyRules) {
            await autoReplyService.ensureAccountMonitoring(rule.telegramAccountId);
        }

        // Content Cloner Listeners
        // Ensure Content Cloner is initialized and monitoring active accounts
        await contentClonerService.initialize();
    }
}
