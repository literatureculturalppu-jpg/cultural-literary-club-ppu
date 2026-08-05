import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { OnboardingForm } from "@/pages/OnboardingForm";
import PendingApproval from "@/pages/PendingApproval";

export function OnboardingGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <>{children}</>;

  // A newly-created (logged in) account must fill the mandatory profile form
  // before doing anything else on the site — no page, link, or icon is
  // reachable until this is done. The only exceptions are the onboarding
  // page itself and logging out.
  if (user && !user.onboardingCompleted && location !== "/onboarding") {
    return <OnboardingForm />;
  }

  // After the profile form is complete, a brand-new member must wait for
  // an admin to approve the account before seeing anything else. Existing
  // members (grandfathered in as "approved" during this feature's rollout)
  // are never affected by this check.
  if (
    user &&
    user.onboardingCompleted &&
    (user.approvalStatus === "pending" || user.approvalStatus === "rejected")
  ) {
    return <PendingApproval status={user.approvalStatus} />;
  }

  return <>{children}</>;
}
