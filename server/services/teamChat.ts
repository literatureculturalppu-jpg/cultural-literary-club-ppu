/**
 * Team chat — intentionally NOT persisted to the database. Long-term storage
 * lives on each member's device (localStorage on the client). This module
 * only keeps a short-lived in-memory buffer per team so messages can be
 * relayed in near-real-time between members who are online at the same time
 * (via polling). The buffer is capped and resets whenever the server
 * restarts — that is expected and by design.
 *
 * Messages can be edited or deleted by their sender, but only within a
 * 6-hour window after being sent — after that the message is permanently
 * locked and no action (edit or delete) can be performed on it by anyone
 * other than a team supervisor/admin doing moderation.
 */

export type TeamChatMessage = {
  id: number;
  teamId: number;
  senderId: number;
  senderName: string;
  content: string;
  createdAt: string; // ISO string
  editedAt?: string | null;
  deleted?: boolean;
};

const MAX_MESSAGES_PER_TEAM = 300;
const EDIT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const teamBuffers = new Map<number, TeamChatMessage[]>();
let nextId = 1;

// A very small, conservative URL matcher used only to let the client render
// links as clickable — it does not affect what can be sent (plain text is
// always allowed; this just decorates http(s) links within that text).
export const URL_PATTERN = /(https?:\/\/[^\s]+)/gi;

export function appendTeamMessage(teamId: number, senderId: number, senderName: string, content: string): TeamChatMessage {
  const message: TeamChatMessage = {
    id: nextId++,
    teamId,
    senderId,
    senderName,
    content,
    createdAt: new Date().toISOString(),
    editedAt: null,
    deleted: false,
  };
  const buffer = teamBuffers.get(teamId) ?? [];
  buffer.push(message);
  if (buffer.length > MAX_MESSAGES_PER_TEAM) {
    buffer.splice(0, buffer.length - MAX_MESSAGES_PER_TEAM);
  }
  teamBuffers.set(teamId, buffer);
  return message;
}

export function getTeamMessagesSince(teamId: number, afterId: number): TeamChatMessage[] {
  const buffer = teamBuffers.get(teamId) ?? [];
  return buffer.filter((m) => m.id > afterId);
}

export function getAllTeamMessages(teamId: number): TeamChatMessage[] {
  return teamBuffers.get(teamId) ?? [];
}

export function getTeamMessageById(teamId: number, messageId: number): TeamChatMessage | null {
  const buffer = teamBuffers.get(teamId) ?? [];
  return buffer.find((m) => m.id === messageId) ?? null;
}

/** True once more than 6 hours have passed since the message was sent. */
export function isMessageLocked(message: TeamChatMessage): boolean {
  return Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS;
}

export type ChatActionError = "NOT_FOUND" | "NOT_OWNER" | "LOCKED" | "DELETED";

/**
 * Edit a message's content in place. Only the original sender may edit
 * their own message, and only within the 6-hour window. Returns the
 * updated message, or an error code identifying why the edit was refused.
 */
export function editTeamMessage(
  teamId: number,
  messageId: number,
  requesterId: number,
  newContent: string
): { message: TeamChatMessage } | { error: ChatActionError } {
  const message = getTeamMessageById(teamId, messageId);
  if (!message) return { error: "NOT_FOUND" };
  if (message.deleted) return { error: "DELETED" };
  if (message.senderId !== requesterId) return { error: "NOT_OWNER" };
  if (isMessageLocked(message)) return { error: "LOCKED" };

  message.content = newContent;
  message.editedAt = new Date().toISOString();
  return { message };
}

/**
 * Delete a message (soft-delete — content is cleared and `deleted` flagged
 * so the UI can show a "تم حذف الرسالة" placeholder). The original sender
 * may delete their own message within the 6-hour window; a team
 * supervisor/admin performing moderation (`isModerator`) may delete any
 * message at any time.
 */
export function deleteTeamMessage(
  teamId: number,
  messageId: number,
  requesterId: number,
  isModerator: boolean
): { message: TeamChatMessage } | { error: ChatActionError } {
  const message = getTeamMessageById(teamId, messageId);
  if (!message) return { error: "NOT_FOUND" };
  if (message.deleted) return { error: "DELETED" };

  if (!isModerator) {
    if (message.senderId !== requesterId) return { error: "NOT_OWNER" };
    if (isMessageLocked(message)) return { error: "LOCKED" };
  }

  message.deleted = true;
  message.content = "";
  return { message };
}
