import type express from "express";
import { sdk } from "../_core/sdk.js";
import { streamChatWithBasir } from "../services/basir.js";
import {
  getAiSettings,
  getBasirDailyLimit,
  getBasirUsageToday,
  incrementBasirUsage,
  logAction,
} from "../db.js";

/**
 * Basir's chat endpoint needs to stream tokens to the browser as they're
 * generated (see `streamChatWithBasir`), which the standard tRPC HTTP batch
 * link doesn't support well. This is therefore a small hand-rolled
 * Server-Sent-Events route living next to (not inside) the tRPC router,
 * reusing the exact same auth, quota, and audit-log plumbing the old
 * `basir.chat` tRPC mutation used.
 *
 * Each event is a JSON payload on its own `data:` line:
 *   {"type":"chunk","text":"..."}   — one piece of the reply, as it's generated
 *   {"type":"done","usage":{...}}   — stream finished successfully
 *   {"type":"error","message":"..."} — something went wrong; stream ends after this
 */

type ChatAttachmentInput = { mimeType: string; data: string };
type ChatMessageInput = { role: "user" | "assistant"; content: string };

function isValidMessages(value: unknown): value is ChatMessageInput[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 50 &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= 10000,
    )
  );
}

function isValidAttachments(value: unknown): value is ChatAttachmentInput[] {
  if (value === undefined) return true;
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every(
      (a) =>
        a &&
        typeof a === "object" &&
        typeof a.mimeType === "string" &&
        a.mimeType.length > 0 &&
        a.mimeType.length <= 100 &&
        typeof a.data === "string" &&
        a.data.length <= 12 * 1024 * 1024,
    )
  );
}

export function registerBasirStreamRoute(app: express.Express) {
  app.post("/api/basir/stream", async (req, res) => {
    // ── Auth ────────────────────────────────────────────────────────
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "يجب تسجيل الدخول لاستخدام بصير" });
      return;
    }

    // ── Input validation ───────────────────────────────────────────
    const { messages, attachments } = req.body ?? {};
    if (!isValidMessages(messages)) {
      res.status(400).json({ error: "طلب غير صالح" });
      return;
    }
    if (!isValidAttachments(attachments)) {
      res.status(400).json({ error: "مرفقات غير صالحة" });
      return;
    }

    // ── Feature flag + quota (checked BEFORE opening the SSE stream so
    //    the client can still surface these as normal JSON errors) ────
    const settings = await getAiSettings();
    if (!settings.enabled) {
      res.status(403).json({ error: "المساعد الذكي بصير غير مفعّل حالياً" });
      return;
    }

    const limit = getBasirDailyLimit(user.role);
    const usedSoFar = await getBasirUsageToday(user.id);
    if (usedSoFar >= limit) {
      res.status(429).json({
        error: `لقد استهلكت حصتك اليومية من الأسئلة (${limit} سؤال). ستتجدد حصتك غداً.`,
      });
      return;
    }

    // Attach files to the last (newest) user message only.
    const messagesForModel = messages.map((m, i) =>
      i === messages.length - 1 && m.role === "user" && attachments?.length
        ? { ...m, attachments }
        : m,
    );

    // ── Open the SSE stream ────────────────────────────────────────
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable proxy buffering (nginx-style edges)
    });
    res.flushHeaders?.();

    const send = (payload: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // If the client disconnects (closed tab, hit "stop"), stop caring about
    // further work — Gemini's own request will still finish server-side,
    // but we won't try to write to a dead response.
    let clientGone = false;
    req.on("close", () => {
      clientGone = true;
    });

    // Keep the connection alive through slow model starts / proxies that
    // time out idle connections.
    const heartbeat = setInterval(() => {
      if (!clientGone) res.write(": ping\n\n");
    }, 15000);

    try {
      const fullText = await streamChatWithBasir(
        messagesForModel,
        {
          id: user.id,
          name: user.name,
          referenceNumber: user.referenceNumber,
          role: user.role,
          email: user.email,
          phoneNumber: user.phoneNumber,
          whatsapp: user.whatsapp,
          college: user.college,
          department: user.department,
          academicYear: user.academicYear,
          specialization: user.specialization,
          approvalStatus: user.approvalStatus,
          createdAt: user.createdAt,
        },
        (delta) => {
          if (!clientGone) send({ type: "chunk", text: delta });
        },
      );

      const newCount = await incrementBasirUsage(user.id);

      // Record assistant usage for auditing without retaining message text,
      // previews, keystrokes, or conversation content.
      void logAction({
        scope: "member",
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: "basir.chat",
        description: `قام ${user.name || "مستخدم"} بمحادثة المساعد الذكي بصير`,
        entityType: "user",
        entityId: user.id,
        metadata: {
          messageCount: messages.length,
          hadAttachments: !!attachments?.length,
        },
      });

      if (!clientGone) {
        send({
          type: "done",
          usage: { used: newCount, limit, remaining: Math.max(0, limit - newCount) },
        });
      }
    } catch (error) {
      console.error("[basir.stream] failed", error);
      if (!clientGone) {
        send({ type: "error", message: "عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى." });
      }
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });
}
