import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

/**
 * Historical route (`/admin/team/:id`) kept only because a few notification
 * links still point here. Team management now fully lives at `/teams/:id`
 * (chat, roster, and — for the team's supervisor/admin — the settings tab),
 * so we just forward there.
 */
export default function TeamMembers() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(`/teams/${params.id}`, { replace: true });
  }, [params.id, setLocation]);

  return null;
}
