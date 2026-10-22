import "server-only";

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const supabaseUrl = readOptional("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = readOptional("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const supabaseServiceRoleKey = readOptional("SUPABASE_SERVICE_ROLE_KEY");
export const encryptionKeysRaw = readOptional("ENCRYPTION_KEYS");
export const encryptionKeyVersion = readOptional("ENCRYPTION_KEY_VERSION");

/**
 * Demo mode activates automatically whenever the app is missing the
 * credentials it needs to talk to a real Supabase project, or when
 * explicitly forced with DEMO_MODE=true. It must never silently activate in
 * a deployment that believes it configured real persistence — that's why
 * every demo code path also renders a visible banner (see DemoModeBanner).
 */
export const isDemoMode: boolean =
  readOptional("DEMO_MODE") === "true" ||
  !supabaseUrl ||
  !supabaseAnonKey ||
  !supabaseServiceRoleKey ||
  !encryptionKeysRaw;

export function requireLiveEnv() {
  if (isDemoMode) {
    throw new Error("This code path requires live Supabase + encryption configuration, but the app is running in demo mode.");
  }
}
