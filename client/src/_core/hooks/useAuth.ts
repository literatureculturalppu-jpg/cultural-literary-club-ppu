import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

const AUTH_BOOTSTRAP_KEY = "club.auth.bootstrap.v1";
const AUTH_BOOTSTRAP_MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

type AuthBootstrap = {
  savedAt: number;
  user: unknown;
};

function readAuthBootstrap() {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(AUTH_BOOTSTRAP_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as AuthBootstrap;
    if (!parsed?.user || !Number.isFinite(parsed.savedAt) || Date.now() - parsed.savedAt > AUTH_BOOTSTRAP_MAX_AGE_MS) {
      localStorage.removeItem(AUTH_BOOTSTRAP_KEY);
      return null;
    }
    return parsed.user;
  } catch {
    localStorage.removeItem(AUTH_BOOTSTRAP_KEY);
    return null;
  }
}

function writeAuthBootstrap(user: unknown) {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(AUTH_BOOTSTRAP_KEY);
    return;
  }
  localStorage.setItem(AUTH_BOOTSTRAP_KEY, JSON.stringify({ savedAt: Date.now(), user }));
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const utils = trpc.useUtils();

  const bootstrapUser = useMemo(readAuthBootstrap, []);
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    // Render the last verified public profile immediately while the HTTP-only
    // cookie is checked in the background. placeholderData is never treated as
    // server authority, so an expired session still becomes signed-out as soon
    // as auth.me returns null.
    ...(bootstrapUser ? { placeholderData: bootstrapUser as never } : {}),
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      writeAuthBootstrap(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  useEffect(() => {
    if (!meQuery.isSuccess) return;
    writeAuthBootstrap(meQuery.data);
  }, [meQuery.data, meQuery.isSuccess]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: ((meQuery.isLoading || meQuery.isFetching) && !bootstrapUser) || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    // Bug fix: OnboardingGuard/OnboardingForm expected `isLoading`/`refetch`
    // (the common TanStack Query naming), but this hook only ever exposed
    // `loading`/`refresh`, so those callers read `undefined` and either
    // treated every render as "still loading" or crashed calling
    // `refetch()`. Keep both names so all existing callers keep working.
    isLoading: state.loading,
    refresh: () => meQuery.refetch(),
    refetch: () => meQuery.refetch(),
    logout,
  };
}
