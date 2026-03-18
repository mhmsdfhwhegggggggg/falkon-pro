import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./drizzle/schema";

const connectionString = "postgresql://postgres:password@localhost:5432/dragon_telegram_pro";
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seed() {
  console.log("Seeding real data...");
  
  // 1. Create a user
  const [user] = await db.insert(schema.users).values({
    email: "user@example.com",
    username: "DragonUser",
    passwordHash: "hashed_password",
  }).returning();
  
  console.log(`Created user: ${user.username}`);

  // 2. Create telegram accounts
  const accounts = await db.insert(schema.telegramAccounts).values([
    {
      userId: user.id,
      phoneNumber: "+201001234567",
      firstName: "Ahmed",
      lastName: "Ali",
      username: "ahmed_ali_tg",
      sessionString: "session_1",
      isActive: true,
      messagesSentToday: 15,
      dailyLimit: 100,
      warmingLevel: 80,
    },
    {
      userId: user.id,
      phoneNumber: "+201119876543",
      firstName: "Sara",
      lastName: "Hassan",
      username: "sara_h_tg",
      sessionString: "session_2",
      isActive: true,
      messagesSentToday: 5,
      dailyLimit: 100,
      warmingLevel: 45,
    }
  ]).returning();
  
  console.log(`Created ${accounts.length} telegram accounts`);

  // 3. Create some activity logs
  await db.insert(schema.activityLogs).values([
    {
      accountId: accounts[0].id,
      action: "message_sent",
      status: "success",
      actionDetails: { to: "user123", message: "Hello!" },
    },
    {
      accountId: accounts[1].id,
      action: "member_extracted",
      status: "success",
      actionDetails: { groupId: "group456", count: 150 },
    }
  ]);
  
  console.log("Created activity logs");
  
  await client.end();
  console.log("Seeding complete!");
}

seed().catch(console.error);
