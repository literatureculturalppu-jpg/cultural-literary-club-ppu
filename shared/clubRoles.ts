export const CLUB_ROLES = [
  "user",
  "admin",
  "supervisor",
  "committee_head",
  "tech_admin",
  "club_president",
  "vice_president",
  "public_relations_officer",
  "secretary",
  "treasurer",
] as const;

export type ClubRole = (typeof CLUB_ROLES)[number];

export const ROLE_LABELS: Record<ClubRole, string> = {
  user: "عضو",
  admin: "مسؤول",
  supervisor: "مشرف السوشيال ميديا",
  committee_head: "مشرف فريق",
  tech_admin: "المدير التقني",
  club_president: "رئيس النادي",
  vice_president: "نائب رئيس النادي",
  public_relations_officer: "مسؤول العلاقات العامة",
  secretary: "أمين السر",
  treasurer: "أمين الصندوق",
};

/** Roles that inherit the general administration surface. */
export const ADMIN_TIER_ROLES = [
  "admin",
  "club_president",
  "vice_president",
  "public_relations_officer",
  "tech_admin",
] as const satisfies readonly ClubRole[];

export function isClubRole(role: string | null | undefined): role is ClubRole {
  return typeof role === "string" && (CLUB_ROLES as readonly string[]).includes(role);
}

export function isAdminTierRole(role: string | null | undefined): boolean {
  return typeof role === "string" && (ADMIN_TIER_ROLES as readonly string[]).includes(role);
}

export function isLeadershipRole(role: string | null | undefined): boolean {
  return role === "club_president" || role === "vice_president";
}

/** Treasury access grants the operational workspace: budgets, transaction
 * drafts, receipts, reports, and the financial audit trail. */
export function canAccessTreasury(role: string | null | undefined): boolean {
  return role === "treasurer" || role === "public_relations_officer" || isLeadershipRole(role) || role === "tech_admin";
}

/** Approval remains a separate safeguard: an approver cannot review a
 * transaction they created themselves. */
export function canApproveTreasury(role: string | null | undefined): boolean {
  return isLeadershipRole(role) || role === "tech_admin";
}

/**
 * Returns an Arabic rejection message when a role transition violates the
 * club hierarchy. General-agent population limits are enforced separately
 * where database access is available.
 */
export function getRoleTransitionDenial(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
  newRole: string | null | undefined,
): string | null {
  if (!actorRole) return "لا يمكن التحقق من صلاحية المنفذ";

  // The technical manager is the only role allowed to take administrative
  // action against either the club president or vice president.
  if (isLeadershipRole(targetRole) && actorRole !== "tech_admin") {
    return "لا يملك صلاحية اتخاذ إجراء بحق رئيس النادي أو نائبه إلا المدير التقني";
  }
  if (isLeadershipRole(newRole) && actorRole !== "tech_admin") {
    return "لا يملك صلاحية تعيين أو إزالة رئيس النادي أو نائبه إلا المدير التقني";
  }

  // Technical management remains the top protected technical role.
  if (targetRole === "tech_admin" && actorRole !== "tech_admin") {
    return "لا يمكن تعديل بيانات المدير التقني أو صلاحياته";
  }
  if (newRole === "tech_admin" && actorRole !== "tech_admin") {
    return "فقط المدير التقني يمكنه ترقية شخص إلى مدير تقني";
  }

  // Ordinary administrators may never manage higher management roles.
  if (actorRole === "admin" && targetRole === "public_relations_officer") {
    return "لا يمكن للمسؤول اتخاذ إجراء بحق منصب إداري أعلى";
  }
  if (actorRole === "admin" && newRole === "public_relations_officer") {
    return "لا يمكن للمسؤول تعيين منصب إداري أعلى";
  }

  return null;
}
