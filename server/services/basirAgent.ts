import { createNotificationsForUsers, getDueBasirAutomations, getDueBasirReminders, getUserById, markBasirAutomationRun, markBasirReminderDelivered } from "../db.js";
import { chatWithBasir, type CurrentUserContext } from "./basir.js";

function toBasirUserContext(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>): CurrentUserContext {
  return { id: user.id, name: user.name ?? null, referenceNumber: user.referenceNumber ?? null, role: user.role, email: user.email ?? null, phoneNumber: user.phoneNumber ?? null, whatsapp: user.whatsapp ?? null, college: user.college ?? null, department: user.department ?? null, academicYear: user.academicYear ?? null, specialization: user.specialization ?? null, approvalStatus: user.approvalStatus, createdAt: user.createdAt ?? null };
}

/** Generates only a short, private in-app reminder for the automation owner. */
export async function runDueBasirAutomations(): Promise<{ ran: number; failed: number }> {
  const due = await getDueBasirAutomations();
  let ran = 0;
  let failed = 0;
  for (const automation of due) {
    try {
      const user = await getUserById(automation.userId);
      if (!user) { await markBasirAutomationRun(automation.id, automation.cadence); continue; }
      const prompt = `هذا تذكير استباقي دوري (${automation.cadence === "weekly" ? "أسبوعي" : "يومي"}) طلب ${user.name || "المستخدم"} أن ترسله له بعنوان: "${automation.title}". اكتب رسالة قصيرة من سطرين إلى أربعة أسطر حول هذا الموضوع، دون مقدمات طويلة أو ادعاء تنفيذ أي إجراء خارجي.`;
      const reply = await chatWithBasir([{ role: "user", content: prompt }], toBasirUserContext(user));
      await createNotificationsForUsers([automation.userId], { type: "announcement", entityId: automation.id, title: `بصير: ${automation.title}`, body: reply.slice(0, 1000), url: "/basir" });
      await markBasirAutomationRun(automation.id, automation.cadence);
      ran++;
    } catch (error) {
      console.error(`[BasirAgent] Failed to run automation ${automation.id}:`, error);
      failed++;
      await markBasirAutomationRun(automation.id, automation.cadence).catch(() => {});
    }
  }
  return { ran, failed };
}

/** Delivers registered-activity reminders only to the activity subscriber. */
export async function runDueBasirReminders(): Promise<{ ran: number; failed: number }> {
  const due = await getDueBasirReminders();
  let ran = 0;
  let failed = 0;
  for (const reminder of due) {
    try {
      await createNotificationsForUsers([reminder.userId], {
        type: "announcement",
        entityId: reminder.activityId ?? reminder.id,
        title: "بصير: تذكير",
        body: reminder.title,
        url: reminder.activityId ? `/activities/${reminder.activityId}` : "/basir",
      });
      await markBasirReminderDelivered(reminder.id);
      ran++;
    } catch (error) {
      console.error(`[BasirAgent] Failed to deliver reminder ${reminder.id}:`, error);
      failed++;
    }
  }
  return { ran, failed };
}
