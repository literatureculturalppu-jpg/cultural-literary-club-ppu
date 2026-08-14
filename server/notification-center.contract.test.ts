import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("notification center contract", () => {
  it("exposes the administrative sender and protected detail endpoint", () => {
    const router = source("server/routers.ts");
    expect(router).toContain("notificationCenter: router");
    expect(router).toContain("send: broadcastProcedure");
    expect(router).toContain("detail: protectedProcedure");
    expect(router).toContain("getUserNotificationDetail(ctx.user.id, input)");
    expect(router).toContain("Array.from(new Set([...audience.map((user) => user.id), ctx.user.id]))");
    expect(router).toContain("const pushDelivered = await sendMobilePushForNotifications");
  });

  it("keeps the user interface and app routes linked to recipient-specific details", () => {
    expect(source("client/src/App.tsx")).toContain('path={"/notifications/:id"}');
    expect(source("client/src/App.tsx")).toContain('path={"/admin/notifications"}');
    expect(source("client/src/components/NotificationBell.tsx")).toContain("navigate(`/notifications/${item.id}`)");
    expect(source("client/src/pages/AdminNotificationCenter.tsx")).toContain("trpc.notificationCenter.send.useMutation");
    expect(source("client/src/pages/NotificationDetail.tsx")).toContain("trpc.notifications.detail.useQuery");
  });

  it("persists rich announcement data and sends the recipient notification identifier", () => {
    const data = source("server/db.ts");
    const push = source("server/services/mobilePush.ts");
    expect(data).toContain("notificationAttachments");
    expect(data).toContain("senderId: payload.senderId ?? null");
    expect(data).toContain("links: payload.links?.length ? JSON.stringify(payload.links) : null");
    expect(push).toContain("sendMobilePushForNotifications");
    expect(push).toContain("url: `/notifications/${notificationId}`");
  });
});
