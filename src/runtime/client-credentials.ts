(() => {
  const bs = (window as unknown as { bs: Record<string, any> }).bs;
  if (bs._request) return;
  let current: { nonce: string; token: string } | undefined;
  let pending: Promise<{ nonce: string; token: string }> | undefined;
  let expires = 0;

  const credentials = () => {
    if (current && Date.now() < expires) return Promise.resolve(current);
    if (!pending) {
      pending = fetch(bs._credentialsUrl, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-BS-Credentials': '1' },
      })
        .then(async (response) => {
          if (!response.ok)
            throw new Error('Blockstudio credential refresh failed');
          const data = await response.json();
          if (
            typeof data.nonce !== 'string' ||
            typeof data.token !== 'string'
          ) {
            throw new Error('Invalid Blockstudio credentials');
          }
          current = data;
          expires = Date.now() + 5 * 60_000;
          bs._token = data.token;
          return data;
        })
        .finally(() => {
          pending = undefined;
        });
    }
    return pending;
  };

  bs._credentials = credentials;
  bs._request = async (url: string, options: RequestInit = {}) => {
    const send = async () => {
      const auth = await credentials();
      const headers = new Headers(options.headers);
      headers.set('X-WP-Nonce', auth.nonce);
      headers.set('X-BS-Token', auth.token);
      return {
        auth,
        response: await fetch(url, {
          ...options,
          credentials: 'same-origin',
          headers,
        }),
      };
    };
    const { auth, response } = await send();
    if (response.status !== 403) return response;
    const error = await response
      .clone()
      .json()
      .catch(() => null);
    if (
      ![
        'rest_cookie_invalid_nonce',
        'blockstudio_fn_csrf',
        'blockstudio_db_csrf',
      ].includes(error?.code)
    ) {
      return response;
    }
    // A parallel request may already have refreshed this same rejected credential pair.
    if (current === auth) {
      current = undefined;
      expires = 0;
    }
    return (await send()).response;
  };

  void credentials().catch(() => {});
})();
