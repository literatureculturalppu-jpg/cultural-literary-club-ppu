import * as db from "../db.js";

type PushPayload = { title: string; body?: string | null; data?: Record<string, unknown> };

/** Sends Expo push messages without making content creation fail when Expo is
 * unavailable. Invalid device registrations are removed opportunistically. */
export async function sendMobilePushToUsers(userIds: number[], payload: PushPayload): Promise<number> {
  try {
    const devices = await db.getMobileDevicesForUsers(userIds);
    const valid = devices.filter((device) => /^(ExponentPushToken|ExpoPushToken)\[.+\]$/.test(device.expoPushToken));
    if (!valid.length) return 0;

    const messages = valid.map((device) => ({
      to: device.expoPushToken,
      sound: "default",
      title: payload.title.slice(0, 200),
      body: (payload.body || "افتح التطبيق لقراءة التفاصيل.").slice(0, 500),
      data: payload.data || {},
      channelId: "club-content",
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    });
    if (!response.ok) throw new Error(`Expo Push ${response.status}`);
    const result = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
    await Promise.all((result.data || []).map(async (ticket, index) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        await db.deleteMobileDeviceByToken(valid[index].expoPushToken);
      }
    }));
    return valid.length;
  } catch (error) {
    console.error("[mobile-push] delivery failed", error);
    return 0;
  }
}
