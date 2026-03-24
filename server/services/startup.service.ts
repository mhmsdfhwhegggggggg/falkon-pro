/**
 * Startup Service 🚀
 * 
 * Orchestrates the initialization of all background services and listeners.
 */
import * as crypto from 'crypto';
import { telegramClientService } from './telegram-client.service';
import { autoReplyService } from './auto-reply.service';
import { contentClonerService } from './content-cloner.service';
import { licenseManager } from './license-manager';
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
        const name = process.env.ADMIN_NAME || 'Falcon Admin';

        // Generate a secure random password if ADMIN_PASSWORD is not set
        let password = process.env.ADMIN_PASSWORD;
        if (!password) {
            password = crypto.randomBytes(24).toString('base64url');
            logger.warn(`[Startup] No ADMIN_PASSWORD set. Generated random password for admin: ${password}`);
            logger.warn('[Startup] Set ADMIN_PASSWORD environment variable to use a fixed password.');
        }

        const database = await db.getDb();
        if (!database) return;

        const existing = await db.getUserByEmail(email);
        if (!existing) {
            logger.info(`[Startup] No admin found. Creating auto-admin: ${email}...`);
            const [admin] = await db.createUser({
                email,
                password: hashPassword(password),
                username: email.split('@')[0],
                role: 'admin',
                isActive: true
            });
            logger.info('[Startup] Auto-Admin created successfully!');

            // Auto-create trial license for admin
            await this.ensureTrialLicense(admin.id);
        } else {
            logger.info('[Startup] Admin check: OK.');
        }
    }

    /**
     * Ensure a trial license exists for a user.
     * Called for new users to unblock them from licenseProtectedProcedure.
     */
    static async ensureTrialLicense(userId: number) {
        try {
            const existing = await licenseManager.getUserActiveLicense(userId);
            if (existing) return;

            const license = await licenseManager.generateLicense({
                userId,
                type: 'trial',
                maxAccounts: 3,
                maxMessages: 500,
                durationDays: 14,
                features: ['basic', 'extraction', 'messaging'],
            });

            if (license) {
                await licenseManager.activateLicense(license.licenseKey);
                logger.info(`[Startup] Auto-trial license created for user ${userId}`);
            }
        } catch (error: any) {
            logger.warn(`[Startup] Failed to create trial license for user ${userId}: ${error.message}`);
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

