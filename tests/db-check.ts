import "dotenv/config";
import { getDb } from '@/server/db';
import { sql } from 'drizzle-orm';

async function checkDb() {
    console.log('--- Checking DB Connectivity & Schema ---');
    console.log('DATABASE_URL present:', !!process.env.DATABASE_URL);
    if (process.env.DATABASE_URL) {
        console.log('DB Type:', process.env.DATABASE_URL.split(':')[0]);
    }
    try {
        const db = await getDb();
        if (!db) {
            console.error('❌ Failed to get DB instance');
            return;
        }

        console.log('✅ DB Instance retrieved');

        // Check if tables exist
        const tables = await db.execute(sql`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log('Tables in DB:', tables.map((t: any) => t.table_name).join(', '));

        const requiredTables = ['users', 'licenses', 'telegram_accounts'];
        for (const table of requiredTables) {
            if (tables.some((t: any) => t.table_name === table)) {
                console.log(`✅ Table '${table}' exists`);
            } else {
                console.error(`❌ Table '${table}' MISSING!`);
            }
        }

    } catch (e: any) {
        console.error('❌ DB Check Failed:', e.message);
    }
}

checkDb();
