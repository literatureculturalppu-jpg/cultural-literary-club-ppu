import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db.js";
import {
  getExternalLinks,
  getExternalLinksByType,
  createExternalLink,
  updateExternalLink,
  deleteExternalLink,
  getActivitySubscriptions,
  getUserActivitySubscriptions,
  createActivitySubscription,
  deleteActivitySubscription,
  isUserSubscribedToActivity,
} from "./db.js";

describe("External Links Database Functions", () => {
  let testLinkId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
  });

  it("should create an external link", async () => {
    const result = await createExternalLink({
      type: "social",
      title: "Facebook",
      url: "https://facebook.com/basira",
      icon: "facebook",
      order: 1,
      isActive: true,
    });

    expect(result).toBeDefined();
    testLinkId = (result as any).insertId || 1;
  });

  it("should get all external links", async () => {
    const links = await getExternalLinks();
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it("should get external links by type", async () => {
    const links = await getExternalLinksByType("social");
    expect(Array.isArray(links)).toBe(true);
    expect(links.every((link) => link.type === "social")).toBe(true);
  });

  it("should update an external link", async () => {
    await updateExternalLink(testLinkId, {
      title: "Facebook Page",
      url: "https://facebook.com/basira-club",
    });

    const links = await getExternalLinks();
    const updated = links.find((l) => l.id === testLinkId);
    expect(updated?.title).toBe("Facebook Page");
  });

  it("should delete an external link", async () => {
    await deleteExternalLink(testLinkId);
    const links = await getExternalLinks();
    const deleted = links.find((l) => l.id === testLinkId);
    expect(deleted).toBeUndefined();
  });
});

describe("Activity Subscriptions Database Functions", () => {
  it("should create an activity subscription", async () => {
    const result = await createActivitySubscription({
      activityId: 1,
      userId: 1,
    });

    expect(result).toBeDefined();
  });

  it("should get activity subscriptions", async () => {
    const subscriptions = await getActivitySubscriptions(1);
    expect(Array.isArray(subscriptions)).toBe(true);
  });

  it("should get user activity subscriptions", async () => {
    const subscriptions = await getUserActivitySubscriptions(1);
    expect(Array.isArray(subscriptions)).toBe(true);
  });

  it("should check if user is subscribed to activity", async () => {
    const isSubscribed = await isUserSubscribedToActivity(1, 1);
    expect(typeof isSubscribed).toBe("boolean");
  });
});
