/** Public client configuration only. Never accept privileged keys here. */
export function getPublicSupabaseConfig(values = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  projectRef: process.env.NEXT_PUBLIC_SUPABASE_PROJECT_REF,
}) {
  const { url, key, projectRef } = values;
  // Do not include configuration values in error messages or logs.
  if (!url || !key || !projectRef) {
    throw new Error("Supabase public configuration is incomplete.");
  }
  if (!/^[a-z]{20}$/.test(projectRef) || url !== `https://${projectRef}.supabase.co`) {
    throw new Error("Supabase URL must match the configured project reference.");
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    throw new Error("A Supabase publishable key is required; privileged keys are forbidden.");
  }
  return { url, key };
}
