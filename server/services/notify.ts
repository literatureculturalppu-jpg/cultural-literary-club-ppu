import * as db from "../db.js";
import { sendBulkEmail, activityEmailTemplate, articleEmailTemplate, achievementEmailTemplate, sendEmail, bookEmailTemplate, activityAcceptanceEmailTemplate, EmailPriority } from "./email.js";

interface NotifyContentCreatedParams {
  type: "activity" | "article" | "achievement";
  entityId: number;
  title: string;
  excerpt: string | null;
  relativeUrl: string;
  excludeUserId: number;
  /** Extra fields only some email templates need (award info, etc). */
  emailExtras?: { awardName?: string | null; awardingOrganization?: string | null };
}

const TYPE_LABELS: Record<string, string> = {
  activity: "نشاط",
  article: "مقال",
  achievement: "إنجاز",
};

export async function notifyContentCreated(params: NotifyContentCreatedParams): Promise<void> {
  console.log(`[notify] New ${params.type} created: "${params.title}" (id=${params.entityId})`);

  try {
    const recipients = await db.getContentNotificationRecipients(params.excludeUserId);
    if (recipients.length === 0) return;

    const typeLabel = TYPE_LABELS[params.type] || params.type;
    const notificationTitle = `تم إضافة ${typeLabel} بعنوان : ${params.title}`;

    await db.createNotificationsForUsers(
      recipients.map((r) => r.id),
      {
        type: params.type,
        entityId: params.entityId,
        title: notificationTitle,
        body: params.excerpt,
        url: params.relativeUrl,
      }
    );

    console.log(`[notify] Sent ${recipients.length} notifications for ${params.type} "${params.title}"`);

    // Fire-and-forget email fan-out. sendBulkEmail never throws (see
    // email.ts), so this can't fail the mutation that triggered it.
    // Priority order (highest to lowest, per club instructions):
    // activity acceptance/publish → achievement → article → book.
    let subject = "";
    let html = "";
    let priority: EmailPriority = EmailPriority.ACTIVITY;
    if (params.type === "activity") {
      subject = `نشاط جديد: ${params.title}`;
      html = activityEmailTemplate({ activityTitle: params.title, activityId: params.entityId });
      priority = EmailPriority.ACTIVITY;
    } else if (params.type === "article") {
      subject = `مقال جديد: ${params.title}`;
      html = articleEmailTemplate({ articleTitle: params.title, excerpt: params.excerpt ?? "", articleId: params.entityId });
      priority = EmailPriority.ARTICLE;
    } else if (params.type === "achievement") {
      subject = `إنجاز جديد: ${params.title}`;
      html = achievementEmailTemplate({
        title: params.title,
        awardName: params.emailExtras?.awardName,
        awardingOrganization: params.emailExtras?.awardingOrganization,
        achievementId: params.entityId,
      });
      priority = EmailPriority.ACHIEVEMENT;
    }
    if (subject && html) {
      await sendBulkEmail(recipients, subject, html, priority);
    }
  } catch (error) {
    console.error("[notify] Failed to create notifications:", error);
  }
}

export async function notifyActivityApproval(userId: number, activityTitle: string, activityId: number): Promise<void> {
  try {
    await db.createNotificationsForUsers(
      [userId],
      {
        type: "activity",
        entityId: activityId,
        title: `تم قبولك في نشاط : ${activityTitle}`,
        body: null,
        url: `/activities/${activityId}`,
      }
    );
    console.log(`[notify] Sent approval notification to user ${userId} for activity "${activityTitle}"`);
  } catch (error) {
    console.error("[notify] Failed to send approval notification:", error);
  }

  try {
    const user = await db.getUserById(userId);
    if (user?.email) {
      await sendEmail(
        user.email,
        `تم قبولك في نشاط: ${activityTitle}`,
        activityAcceptanceEmailTemplate({
          recipientName: user.arabicFullName || user.name || "عزيزنا العضو",
          activityTitle,
          activityId,
          isGuest: false,
        }),
        EmailPriority.ACTIVITY
      );
    }
  } catch (error) {
    console.error("[notify] Failed to email approval notification:", error);
  }
}

/** Same as notifyActivityApproval, but for a guest registration (no user
 * account) — so it needs the guest's name/email passed in directly. */
export async function notifyGuestActivityApproval(
  guestName: string,
  guestEmail: string,
  activityTitle: string,
  activityId: number
): Promise<void> {
  try {
    await sendEmail(
      guestEmail,
      `تم قبولك في نشاط: ${activityTitle}`,
      activityAcceptanceEmailTemplate({
        recipientName: guestName,
        activityTitle,
        activityId,
        isGuest: true,
      }),
      EmailPriority.ACTIVITY
    );
  } catch (error) {
    console.error("[notify] Failed to email guest approval notification:", error);
  }
}

/** Book creation isn't part of the shared content-notification enum (no
 * in-app notification type for it yet), so it gets its own light-weight
 * email-only notifier. */
export async function notifyBookCreated(bookTitle: string, author: string, excludeUserId: number): Promise<void> {
  try {
    const recipients = await db.getContentNotificationRecipients(excludeUserId);
    if (recipients.length === 0) return;
    await sendBulkEmail(recipients, `كتاب جديد: ${bookTitle}`, bookEmailTemplate({ bookTitle, author }), EmailPriority.BOOK);
  } catch (error) {
    console.error("[notify] Failed to email new-book notification:", error);
  }
}

/**
 * Team chat messages and team management requests are surfaced ONLY as
 * in-app notifications (bell icon) — intentionally no email dispatch here,
 * per product requirement that team activity stays inside the app.
 */
export async function notifyTeamInApp(
  userIds: number[],
  params: { entityId: number; title: string; body?: string | null; url: string; type?: "team_chat" | "team_request" }
): Promise<void> {
  try {
    if (userIds.length === 0) return;
    await db.createNotificationsForUsers(userIds, {
      type: params.type ?? "team_request",
      entityId: params.entityId,
      title: params.title,
      body: params.body ?? null,
      url: params.url,
    });
  } catch (error) {
    console.error("[notify] Failed to send team notification:", error);
  }
}
