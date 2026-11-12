// Framework-independent Auth operations. Call only through server-side wrappers.
// Client factories are request scoped and use the public key + user's cookies.
export async function passwordLogin(formData, clientFactory) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" ||
      email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length === 0 || password.length > 4096) return "invalid";
  try {
    const client = await clientFactory();
    const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    // A session, not an unverified email response, is required before success.
    return !error && data?.session ? "success" : "invalid";
  } catch {
    return "unavailable";
  }
}

export async function localLogout(clientFactory) {
  try {
    const client = await clientFactory();
    const { error } = await client.auth.signOut({ scope: "local" });
    return error ? "unavailable" : "success";
  } catch {
    return "unavailable";
  }
}

export async function loadMemberStores(client) {
  try {
    // Always contact Auth server; never authorize from cookies/getSession alone.
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user?.id) {
      return { status: error?.status >= 500 ? "unavailable" : "unauthorized", stores: [] };
    }
    const userId = data.user.id;
    const memberships = await client.from("store_members")
      .select("store_id,user_id,role").eq("user_id", userId);
    if (memberships.error || !Array.isArray(memberships.data)) return { status: "unavailable", stores: [] };
    const roles = new Map();
    for (const member of memberships.data) {
      if (member.user_id === userId && typeof member.store_id === "string" &&
          ["owner", "staff"].includes(member.role)) roles.set(member.store_id, member.role);
    }
    if (roles.size === 0) return { status: "ready", stores: [] };
    const result = await client.from("stores")
      .select("id,name,slug,status,currency").in("id", [...roles.keys()]);
    if (result.error || !Array.isArray(result.data)) return { status: "unavailable", stores: [] };
    // Intersect again rather than trusting query results or request-supplied IDs.
    const stores = result.data.filter((store) => roles.has(store.id)).map((store) => ({
      id: store.id,
      name: typeof store.name === "string" ? store.name : "Unnamed store",
      slug: typeof store.slug === "string" ? store.slug : "",
      status: typeof store.status === "string" ? store.status : "Unknown",
      currency: typeof store.currency === "string" ? store.currency : "Unknown",
      role: roles.get(store.id),
    }));
    return { status: "ready", stores };
  } catch {
    return { status: "unavailable", stores: [] };
  }
}
