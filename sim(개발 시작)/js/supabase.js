(function () {
  const LIBRARY = "node_modules/@supabase/supabase-js/dist/umd/supabase.js?v=2.119.0";
  let clientPromise = null;

  function loadLibrary() {
    return new Promise((resolve, reject) => {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        resolve(window.supabase);
        return;
      }
      const script = document.createElement("script");
      script.src = LIBRARY;
      script.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === "function") resolve(window.supabase);
        else reject(new Error("library"));
      };
      script.onerror = () => reject(new Error("library"));
      document.head.appendChild(script);
    });
  }

  function getClient() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const response = await fetch("/api/supabase-config");
        const config = await response.json().catch(() => ({}));
        if (!response.ok || !config.url || !config.publishableKey) {
          clientPromise = null;
          const error = new Error(config.error || "missing-config");
          error.code = config.error || "missing-config";
          throw error;
        }
        const lib = await loadLibrary();
        return lib.createClient(config.url, config.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: "pkce"
          }
        });
      })();
    }
    return clientPromise;
  }

  function redirectTo() {
    return `${location.origin}${location.pathname}`;
  }

  async function signUp(email, password) {
    const client = await getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo() }
    });
    return { data, error };
  }

  async function signIn(email, password) {
    const client = await getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signOut() {
    const client = await getClient();
    const { error } = await client.auth.signOut();
    return { error };
  }

  async function currentSession() {
    const client = await getClient();
    const { data, error } = await client.auth.getSession();
    return { session: data ? data.session : null, error };
  }

  function onAuthChange(callback) {
    return getClient().then((client) => client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    }));
  }

  async function publishedTerms() {
    const client = await getClient();
    const { data, error } = await client
      .from("terms")
      .select("id,term,ko,say,cat,blurb,body,usage,example,example_ko,aliases,related")
      .is("owner_id", null)
      .eq("status", "published")
      .eq("learned", false);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function testConnection() {
    try {
      const client = await getClient();
      const { data, error } = await client.auth.getSession();
      if (error) return { ok: false, error: error.message };
      return { ok: true, signedIn: Boolean(data && data.session) };
    } catch (error) {
      return { ok: false, error: error.code || error.message };
    }
  }

  window.SIM_SUPABASE = { getClient, publishedTerms, testConnection, signUp, signIn, signOut, currentSession, onAuthChange };
})();
