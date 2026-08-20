import { describe, expect, it } from "vitest";
import { canAccessTreasury, canApproveTreasury, getRoleTransitionDenial, isAdminTierRole } from "../shared/clubRoles.js";

describe("club leadership role policy", () => {
  it("grants every executive administrative role the general admin tier", () => {
    expect(isAdminTierRole("club_president")).toBe(true);
    expect(isAdminTierRole("vice_president")).toBe(true);
    expect(isAdminTierRole("public_relations_officer")).toBe(true);
    expect(isAdminTierRole("secretary")).toBe(false);
    expect(isAdminTierRole("treasurer")).toBe(false);
  });

  it("reserves action against the president and vice president for the technical manager", () => {
    expect(getRoleTransitionDenial("club_president", "vice_president", "user")).toContain("المدير التقني");
    expect(getRoleTransitionDenial("vice_president", "club_president", "user")).toContain("المدير التقني");
    expect(getRoleTransitionDenial("admin", "club_president", "admin")).toContain("المدير التقني");
    expect(getRoleTransitionDenial("tech_admin", "club_president", "admin")).toBeNull();
    expect(getRoleTransitionDenial("tech_admin", "vice_president", "admin")).toBeNull();
  });

  it("prevents non-technical roles from appointing the protected leadership posts", () => {
    expect(getRoleTransitionDenial("admin", "user", "club_president")).toContain("المدير التقني");
    expect(getRoleTransitionDenial("club_president", "user", "vice_president")).toContain("المدير التقني");
    expect(getRoleTransitionDenial("tech_admin", "user", "vice_president")).toBeNull();
  });

  it("grants full treasury operating access to the treasurer and every explicitly authorized role", () => {
    expect(canAccessTreasury("treasurer")).toBe(true);
    expect(canAccessTreasury("tech_admin")).toBe(true);
    expect(canAccessTreasury("club_president")).toBe(true);
    expect(canAccessTreasury("vice_president")).toBe(true);
    expect(canAccessTreasury("public_relations_officer")).toBe(true);
    expect(canAccessTreasury("secretary")).toBe(false);
    expect(canAccessTreasury("admin")).toBe(false);
  });

  it("keeps approval separate from operating access and prevents self-approval safeguards from weakening", () => {
    expect(canApproveTreasury("tech_admin")).toBe(true);
    expect(canApproveTreasury("club_president")).toBe(true);
    expect(canApproveTreasury("vice_president")).toBe(true);
    expect(canApproveTreasury("public_relations_officer")).toBe(false);
    expect(canApproveTreasury("treasurer")).toBe(false);
  });
});
