/**
 * One-time seed for the founding board ("الهيئة الإدارية التأسيسية") of
 * Basira Club, plus the club's founding Technical Admin.
 *
 * Run this ONCE, after `drizzle/0003_team_members_founders.sql` has been
 * applied (it adds the `isFounder` column that this script relies on).
 *
 * All six rows are inserted with `isFounder: true`, since they hold the
 * club's very first positions (first president, first vice president,
 * first tech admin, etc.). Whoever succeeds any of them later should be
 * added as a normal team member (isFounder defaults to false) through the
 * regular "Add Team Member" admin flow — NOT through this script.
 *
 * Safe to re-run: rows are matched by (name, position) and skipped if they
 * already exist, so nothing gets duplicated.
 *
 * Usage:
 *   pnpm run seed:founding-team
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { teamMembers, type InsertTeamMember } from "../drizzle/schema.js";

const FOUNDING_MEMBERS: InsertTeamMember[] = [
  {
    name: "عمرة حسن صوالحة",
    position: "رئيسة النادي",
    bio:
      "التخصص: هندسة أنظمة حاسوب. الدور: إعداد وتقديم خطة عمل متكاملة للنادي بالتنسيق مع أعضاء اللجنة والمشرف وعميد الكلية ورفعها مع الميزانية المقترحة لاعتمادها، وتوزيع المهام حسب الخطة المعتمدة، ومتابعة تنفيذ برامج وأنشطة النادي خلال العام الدراسي، وتقديم تقرير عن كل نشاط وتقرير ختامي مع نهاية كل فصل دراسي، ومتابعة وتدقيق فواتير ومصاريف النادي مع أمين الصندوق، والحرص على تمثيل الجامعة بشكل مشرف والتعامل مع الأعضاء والطلاب باحترام، ودعوة اللجنة التنفيذية للاجتماع ورئاسة جلساتها وإبلاغ مشرف النادي بقراراتها، وإعداد بيان بتوزيع المسؤوليات على الأعضاء، وعقد اجتماعات دورية بالتنسيق مع المشرف، وعمل قاعدة معلومات عن أعضاء النادي وجداولهم الدراسية.",
    order: 1,
    isFounder: true,
  },
  {
    name: "ليلى خالد مناصرة",
    position: "نائبة رئيس النادي",
    bio:
      "التخصص: هندسة ميكاترونكس. الدور: تنوب عن رئيسة النادي في حال غيابها أو مرضها أو انسحابها، وتقوم بالأعمال التي تطلبها منها رئيسة النادي.",
    order: 2,
    isFounder: true,
  },
  {
    name: "هدى محمود مناصرة",
    position: "أمينة سر النادي",
    bio:
      "التخصص: علم حاسوب. الدور: التحضير لاجتماعات اللجنة التنفيذية وإعداد محاضر الجلسات وفق الأصول وتضمين الموضوعات التي ستُعرض، والتأكد من اشتمال المذكرات على الوثائق المطلوبة، ودعوة أعضاء اللجنة لحضور الجلسات، ومتابعة توقيع قرارات المجلس من قبل جميع الأعضاء ومتابعة تنفيذها حسب الأصول، وإنشاء الرسائل والكتب الرسمية وجميع المخاطبات المتعلقة بقرارات مجلس الهيئة، وتوثيق وأرشفة القرارات والمحاضر وكل ما يتعلق بها من وثائق ومرفقات وسجلات رسمية، وإعداد التقرير السنوي بالتنسيق مع قسم العلاقات العامة وباقي الأقسام، وأي أعمال أخرى تُكلَّف بها.",
    order: 3,
    isFounder: true,
  },
  {
    name: "نبيل جمال الخطيب",
    position: "أمين صندوق النادي",
    bio:
      "التخصص: هندسة أنظمة حاسوب. الدور: توقيع أذون الصرف وسندات القبض، وجمع الأموال العائدة للنادي (انتسابات، اشتراكات، هبات) بالتنسيق مع اللجنة الإشرافية، ومحاسبة أي لجنة تجري نشاطاً له دخل، والاحتفاظ بالسجلات المالية المختلفة، وتقديم تقرير شهري عن الوضع المالي للهيئة الإدارية، والاحتفاظ بمبلغ معقول تقره أنظمة النادي الداخلية.",
    order: 4,
    isFounder: true,
  },
  {
    name: "سلسبيل حسن صوالحة",
    position: "مسؤولة العلاقات العامة",
    bio:
      "التخصص: هندسة ميكاترونكس. الدور: التغطيات الإعلامية والإشراف على الرصد الصحفي، وتخطيط الحملات الإعلامية، والإشراف على الموقع الإلكتروني وحسابات التواصل الاجتماعي والمعارض والفعاليات، ومتابعة إعداد المواد الإعلامية شكلاً ومضموناً، والإشراف على البروتوكول والمراسم، وقياس أثر الأنشطة والفعاليات، والتواصل الدائم مع الداعمين والمانحين وزيارة الجهات المانحة والشركات ورجال الأعمال.",
    order: 5,
    isFounder: true,
  },
  {
    name: "أحمد كامل عيده",
    position: "المدير التقني للنادي ومؤسس موقع الويب وصاحب الفكرة",
    bio:
      "التخصص: هندسة ميكاترونكس. الدور: تطوير الموقع وتأمينه بشكل مستمر، والمساعدة في عمليات النشر والقبول، وإدارة الموقع، ومساعدة الأعضاء في أي مشاكل تقنية تواجههم فيه. للتواصل عبر واتساب: +972568081719.",
    phone: "+972568081719",
    order: 6,
    isFounder: true,
  },
];

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

  let inserted = 0;
  let skipped = 0;

  for (const member of FOUNDING_MEMBERS) {
    const existing = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.name, member.name), eq(teamMembers.position, member.position)))
      .limit(1);

    if (existing.length > 0) {
      console.log(`↷ Skipped (already exists): ${member.name} — ${member.position}`);
      skipped++;
      continue;
    }

    await db.insert(teamMembers).values(member);
    console.log(`✔ Inserted: ${member.name} — ${member.position}`);
    inserted++;
  }

  console.log(`\nDone. Inserted ${inserted}, skipped ${skipped}.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
