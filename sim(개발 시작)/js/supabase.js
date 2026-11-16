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
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      })();
    }
    return clientPromise;
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

  window.SIM_SUPABASE = { getClient, testConnection };
})();
