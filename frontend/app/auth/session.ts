import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const authority = process.env.NEXT_PUBLIC_COGNITO_AUTHORITY;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
export const authConfigured = Boolean(authority && clientId && domain);
let manager: UserManager | undefined;
let initialization: ReturnType<UserManager["getUser"]> | undefined;

export function getAuthManager() {
  if (!authConfigured || typeof window === "undefined") throw new Error("認証設定がありません。");
  manager ??= new UserManager({
    authority: authority!,
    client_id: clientId!,
    redirect_uri: `${window.location.origin}/`,
    response_type: "code",
    scope: "openid email reading-room/access",
    automaticSilentRenew: false,
    loadUserInfo: true,
    revokeTokenTypes: ["refresh_token"],
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    staleStateAgeInSeconds: 600,
  });
  return manager;
}

// Share the callback promise so React StrictMode cannot redeem a code twice.
export function initializeAuth() {
  initialization ??= (async () => {
    const auth = getAuthManager();
    const params = new URLSearchParams(window.location.search);
    try {
      if (params.has("code") || params.has("error")) {
        const user = await auth.signinRedirectCallback(window.location.href);
        return user;
      }
      const user = await auth.getUser();
      if (user?.expired) {
        await auth.removeUser();
        return null;
      }
      return user;
    } finally {
      // Do not leave one-time codes or provider error details in the address bar.
      if (params.has("code") || params.has("error")) window.history.replaceState({}, "", "/");
      await auth.clearStaleState();
    }
  })();
  return initialization;
}

export async function login() {
  await getAuthManager().signinRedirect();
}

export async function logout() {
  const auth = getAuthManager();
  try {
    await auth.revokeTokens(["refresh_token"]);
  } catch {
    // Local logout and Cognito cookie logout must still work if revocation fails.
  }
  await auth.removeUser();
  const url = new URL("/logout", domain!);
  url.searchParams.set("client_id", clientId!);
  url.searchParams.set("logout_uri", `${window.location.origin}/`);
  window.location.assign(url.href);
}

// For future API calls: use an access token, never the ID token.
// Authorization and membership checks still belong to API Gateway / Go.
export async function getAccessToken(): Promise<string | null> {
  if (!authConfigured) return null;
  const user = await getAuthManager().getUser();
  return user && !user.expired ? user.access_token : null;
}
