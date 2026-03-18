import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../server/db/schema";
import { hashPassword } from "../server/_core/crypto";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not set!");
    process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function createAdmin() {
    const email = process.argv[2] || "admin@falcon.pro";
    const password = process.argv[3] || "admin123";
    const username = process.argv[4] || "Admin";

    console.log(`🔐 Creating Admin User...`);
    console.log(`   Email: ${email}`);
    console.log(`   Username: ${username}`);

    try {
        // Check if user exists
        const existing = await db.query.users.findFirst({
            where: eq(schema.users.email, email)
        });

        if (existing) {
            console.log("⚠️ User already exists. Updating to Admin role...");
            await db.update(schema.users)
                .set({ role: "admin", password: hashPassword(password) })
                .where(eq(schema.users.email, email));
            console.log("✅ User updated to Admin successfully!");
        } else {
            const hashedPassword = hashPassword(password);
            await db.insert(schema.users).values({
                email,
                username,
                password: hashedPassword,
                isActive: true,
                role: "admin"
            });
            console.log("✅ Admin user created successfully!");
        }
    } catch (error) {
        console.error("❌ Failed to create admin:", error);
    } finally {
        await client.end();
    }
}

createAdmin().catch(console.error);
