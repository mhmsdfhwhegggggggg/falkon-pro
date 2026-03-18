import Database from "better-sqlite3";
import * as crypto from "crypto";

const db = new Database("./dev.db");

console.log("🌱 Seeding database...");

// Create a demo user
const insertUser = db.prepare(`
  INSERT INTO users (email, username, password_hash, is_active)
  VALUES (?, ?, ?, ?)
`);

const passwordHash = crypto.createHash("sha256").update("demo123").digest("hex");
const userResult = insertUser.run(
  "demo@dragontelegram.pro",
  "demo_user",
  passwordHash,
  1
);

const userId = userResult.lastInsertRowid;
console.log(`✅ Created demo user with ID: ${userId}`);

// Create demo telegram accounts
const insertAccount = db.prepare(`
  INSERT INTO telegram_accounts (
    user_id, phone_number, telegram_id, first_name, last_name, username,
    session_string, is_active, warming_level, daily_limit
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const accounts = [
  {
    phoneNumber: "+1234567890",
    telegramId: "123456789",
    firstName: "Demo",
    lastName: "Account 1",
    username: "demo_account_1",
    sessionString: "demo_session_string_encrypted_1",
    warmingLevel: 75,
    dailyLimit: 100,
  },
  {
    phoneNumber: "+9876543210",
    telegramId: "987654321",
    firstName: "Demo",
    lastName: "Account 2",
    username: "demo_account_2",
    sessionString: "demo_session_string_encrypted_2",
    warmingLevel: 50,
    dailyLimit: 150,
  },
  {
    phoneNumber: "+5555555555",
    telegramId: "555555555",
    firstName: "Demo",
    lastName: "Account 3",
    username: "demo_account_3",
    sessionString: "demo_session_string_encrypted_3",
    warmingLevel: 90,
    dailyLimit: 200,
  },
];

const accountIds: number[] = [];
for (const account of accounts) {
  const result = insertAccount.run(
    userId,
    account.phoneNumber,
    account.telegramId,
    account.firstName,
    account.lastName,
    account.username,
    account.sessionString,
    1,
    account.warmingLevel,
    account.dailyLimit
  );
  accountIds.push(Number(result.lastInsertRowid));
  console.log(`✅ Created telegram account: ${account.phoneNumber}`);
}

// Create demo extracted members
const insertMember = db.prepare(`
  INSERT INTO extracted_members (
    account_id, user_id, username, first_name, last_name, phone_number,
    is_bot, is_premium, source_group_id, source_group_title, is_active
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const members = [
  {
    userId: "111111111",
    username: "user1",
    firstName: "John",
    lastName: "Doe",
    phoneNumber: "+1111111111",
    sourceGroupId: "-1001234567890",
    sourceGroupTitle: "Demo Group 1",
  },
  {
    userId: "222222222",
    username: "user2",
    firstName: "Jane",
    lastName: "Smith",
    phoneNumber: "+2222222222",
    sourceGroupId: "-1001234567890",
    sourceGroupTitle: "Demo Group 1",
  },
  {
    userId: "333333333",
    username: "user3",
    firstName: "Bob",
    lastName: "Johnson",
    phoneNumber: null,
    sourceGroupId: "-1009876543210",
    sourceGroupTitle: "Demo Group 2",
  },
  {
    userId: "444444444",
    username: "user4",
    firstName: "Alice",
    lastName: "Williams",
    phoneNumber: "+4444444444",
    sourceGroupId: "-1009876543210",
    sourceGroupTitle: "Demo Group 2",
  },
  {
    userId: "555555555",
    username: "premium_user",
    firstName: "Premium",
    lastName: "User",
    phoneNumber: "+5555555555",
    sourceGroupId: "-1001234567890",
    sourceGroupTitle: "Demo Group 1",
  },
];

for (const member of members) {
  insertMember.run(
    accountIds[0],
    member.userId,
    member.username,
    member.firstName,
    member.lastName,
    member.phoneNumber,
    0,
    member.username === "premium_user" ? 1 : 0,
    member.sourceGroupId,
    member.sourceGroupTitle,
    1
  );
}
console.log(`✅ Created ${members.length} extracted members`);

// Create demo statistics
const insertStats = db.prepare(`
  INSERT INTO statistics (
    user_id, date, messages_sent, messages_failed, members_extracted,
    groups_joined, users_added, operations_completed
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split("T")[0];

const stats = [
  {
    date: today,
    messagesSent: 45,
    messagesFailed: 3,
    membersExtracted: 120,
    groupsJoined: 2,
    usersAdded: 15,
    operationsCompleted: 3,
  },
  {
    date: yesterday,
    messagesSent: 78,
    messagesFailed: 5,
    membersExtracted: 250,
    groupsJoined: 3,
    usersAdded: 25,
    operationsCompleted: 5,
  },
  {
    date: twoDaysAgo,
    messagesSent: 92,
    messagesFailed: 2,
    membersExtracted: 180,
    groupsJoined: 1,
    usersAdded: 30,
    operationsCompleted: 4,
  },
];

for (const stat of stats) {
  insertStats.run(
    userId,
    stat.date,
    stat.messagesSent,
    stat.messagesFailed,
    stat.membersExtracted,
    stat.groupsJoined,
    stat.usersAdded,
    stat.operationsCompleted
  );
}
console.log(`✅ Created statistics for ${stats.length} days`);

// Create demo bulk operations
const insertOperation = db.prepare(`
  INSERT INTO bulk_operations (
    user_id, type, status, total_targets, processed_targets, success_count,
    failed_count, config, message_template, delay_ms, auto_repeat
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const operations = [
  {
    type: "send_message",
    status: "completed",
    totalTargets: 50,
    processedTargets: 50,
    successCount: 47,
    failedCount: 3,
    config: JSON.stringify({ accountIds: [accountIds[0]] }),
    messageTemplate: "Hello! This is a demo message.",
    delayMs: 2000,
    autoRepeat: 0,
  },
  {
    type: "add_user",
    status: "running",
    totalTargets: 100,
    processedTargets: 45,
    successCount: 40,
    failedCount: 5,
    config: JSON.stringify({ accountIds: [accountIds[1]], targetGroupId: "-1001234567890" }),
    messageTemplate: null,
    delayMs: 3000,
    autoRepeat: 0,
  },
  {
    type: "join_group",
    status: "pending",
    totalTargets: 10,
    processedTargets: 0,
    successCount: 0,
    failedCount: 0,
    config: JSON.stringify({ accountIds: [accountIds[2]] }),
    messageTemplate: null,
    delayMs: 5000,
    autoRepeat: 1,
  },
];

for (const operation of operations) {
  insertOperation.run(
    userId,
    operation.type,
    operation.status,
    operation.totalTargets,
    operation.processedTargets,
    operation.successCount,
    operation.failedCount,
    operation.config,
    operation.messageTemplate,
    operation.delayMs,
    operation.autoRepeat
  );
}
console.log(`✅ Created ${operations.length} bulk operations`);

// Create demo proxies
const insertProxy = db.prepare(`
  INSERT INTO proxy_configs (
    account_id, host, port, type, username, password, is_active, is_working
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const proxies = [
  {
    accountId: accountIds[0],
    host: "proxy1.example.com",
    port: 1080,
    type: "socks5",
    username: "user1",
    password: "pass1",
  },
  {
    accountId: accountIds[1],
    host: "proxy2.example.com",
    port: 8080,
    type: "http",
    username: "user2",
    password: "pass2",
  },
  {
    accountId: null,
    host: "proxy3.example.com",
    port: 1080,
    type: "socks5",
    username: null,
    password: null,
  },
];

for (const proxy of proxies) {
  insertProxy.run(
    proxy.accountId,
    proxy.host,
    proxy.port,
    proxy.type,
    proxy.username,
    proxy.password,
    1,
    1
  );
}
console.log(`✅ Created ${proxies.length} proxy configs`);

// Create demo group metadata
const insertGroup = db.prepare(`
  INSERT INTO group_metadata (
    group_id, title, username, member_count, description, is_public
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

const groups = [
  {
    groupId: "-1001234567890",
    title: "Demo Group 1",
    username: "demo_group_1",
    memberCount: 1250,
    description: "This is a demo group for testing",
    isPublic: 1,
  },
  {
    groupId: "-1009876543210",
    title: "Demo Group 2",
    username: "demo_group_2",
    memberCount: 850,
    description: "Another demo group",
    isPublic: 1,
  },
  {
    groupId: "-1005555555555",
    title: "Private Demo Group",
    username: null,
    memberCount: 450,
    description: "A private demo group",
    isPublic: 0,
  },
];

for (const group of groups) {
  insertGroup.run(
    group.groupId,
    group.title,
    group.username,
    group.memberCount,
    group.description,
    group.isPublic
  );
}
console.log(`✅ Created ${groups.length} group metadata entries`);

db.close();
console.log("\n🎉 Database seeding completed successfully!");
console.log("\n📊 Summary:");
console.log(`   - Users: 1`);
console.log(`   - Telegram Accounts: ${accounts.length}`);
console.log(`   - Extracted Members: ${members.length}`);
console.log(`   - Statistics: ${stats.length} days`);
console.log(`   - Bulk Operations: ${operations.length}`);
console.log(`   - Proxies: ${proxies.length}`);
console.log(`   - Groups: ${groups.length}`);
console.log("\n🔑 Demo Credentials:");
console.log(`   Email: demo@dragontelegram.pro`);
console.log(`   Password: demo123`);
