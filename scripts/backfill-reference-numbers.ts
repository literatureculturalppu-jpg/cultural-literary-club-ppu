/**
 * One-time backfill for the "reference number" + "member approval" feature.
 *
 * Run this ONCE, immediately after `pnpm run db:push` adds the new columns,
 * and BEFORE deploying the updated server code to production. It:
 *
 *   1. Assigns a permanent reference number (YYNNNN) to every existing user
 *      who doesn't have one yet, ordered by their original signup date
 *      (`createdAt`) within their signup year — so join order is preserved
 *      as closely as possible for people who registered before this update.
 *   2. Marks every existing user as "approved" (grandfathered in), since
 *      the approval gate should only ever apply to brand-new sign-ups from
 *      this point forward, never retroactively lock out current members.
 *
 * Safe to re-run: it only touches rows that still need it.
 *
 * Usage:
 *   pnpm run backfill:members
 */
import "dotenv/config";
import { eq, isNull, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, referenceNumberCounters } from "../drizzle/schema.js";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required to run this script");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  // ── Step 1: approve every existing user ──────────────────────────────────
  const approvedResult = await db
    .update(users)
    .set({ approvalStatus: "approved", approvedAt: new Date() })
    .where(eq(users.approvalStatus, "pending"))
    .returning({ id: users.id });
  console.log(`✔ Approved ${approvedResult.length} existing member(s) (grandfathered in).`);

  // ── Step 2: assign reference numbers to anyone missing one ───────────────
  const usersNeedingNumbers = await db
    .select({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .where(isNull(users.referenceNumber))
    .orderBy(asc(users.createdAt));

  if (usersNeedingNumbers.length === 0) {
    console.log("✔ No users need a reference number — nothing to do.");
    await pool.end();
    return;
  }

  // Group by the year they actually joined (not the current year), so
  // someone who joined in 2024 gets a "24xxxx" number, not a "26xxxx" one.
  const byYear = new Map<number, { id: number }[]>();
  for (const u of usersNeedingNumbers) {
    const year = new Date(u.createdAt as unknown as string).getFullYear();
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push({ id: u.id });
  }

  let totalAssigned = 0;
  for (const [year, group] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const yy = String(year % 100).padStart(2, "0");
    for (const u of group) {
      const [{ counter }] = await db
        .insert(referenceNumberCounters)
        .values({ year, counter: 1 })
        .onConflictDoUpdate({
          target: referenceNumberCounters.year,
          set: { counter: sql`${referenceNumberCounters.counter} + 1` },
        })
        .returning({ counter: referenceNumberCounters.counter });

      const seq = String(counter).padStart(4, "0");
      const referenceNumber = `${yy}${seq}`;
      await db.update(users).set({ referenceNumber }).where(eq(users.id, u.id));
      totalAssigned++;
      console.log(`  → user #${u.id}: ${referenceNumber}`);
    }
  }

  console.log(`✔ Assigned reference numbers to ${totalAssigned} user(s).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
