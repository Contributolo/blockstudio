import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(
  'includes/assets/runtime/client-credentials.js',
  'utf8',
);

function setup() {
  const bs: any = { _credentialsUrl: '/credentials' };
  const requests: Array<{ url: string; options: any }> = [];
  let clock = 0;
  let refreshes = 0;
  let error = '';
  let failures = 0;
  let rejectRefresh = false;
  const globals = {
    window: { bs },
    Headers,
    Promise,
    Date: { now: () => clock },
    fetch: async (url: string, options: any) => {
      requests.push({ url, options });
      if (url === '/credentials') {
        refreshes++;
        if (rejectRefresh) return Response.json({}, { status: 503 });
        return Response.json({
          nonce: `nonce-${refreshes}`,
          token: `token-${refreshes}`,
        });
      }
      if (failures-- > 0)
        return Response.json({ code: error }, { status: 403 });
      return Response.json({ ok: true });
    },
  };
  runInNewContext(source, globals);
  return {
    bs,
    requests,
    globals,
    refreshes: () => refreshes,
    age: () => {
      clock += 6 * 60_000;
    },
    reject: (code: string, count = 1) => {
      error = code;
      failures = count;
    },
    rejectRefresh: (value: boolean) => {
      rejectRefresh = value;
    },
  };
}

test('RPC/database transport shares one uncached credential fetch across simultaneous calls', async () => {
  const env = setup();
  await Promise.all(
    Array.from({ length: 20 }, () =>
      env.bs._request('/operation', { method: 'POST', body: '{"value":1}' }),
    ),
  );
  assert.equal(env.refreshes(), 1);
  const credentialRequest = env.requests[0].options;
  assert.equal(credentialRequest.cache, 'no-store');
  assert.equal(credentialRequest.credentials, 'same-origin');
  assert.equal(credentialRequest.headers['X-BS-Credentials'], '1');
  for (const { options } of env.requests.slice(1)) {
    assert.equal(options.headers.get('X-WP-Nonce'), 'nonce-1');
    assert.equal(options.headers.get('X-BS-Token'), 'token-1');
    assert.equal(options.body, '{"value":1}');
  }
  assert.equal(env.bs._token, 'token-1');
});

test('long-lived pages refresh credentials and duplicate client injection does not reset them', async () => {
  const env = setup();
  await env.bs._credentials();
  runInNewContext(source, env.globals);
  assert.equal(env.refreshes(), 1);
  env.age();
  await env.bs._request('/operation');
  assert.equal(env.refreshes(), 2);
  assert.equal(
    env.requests[env.requests.length - 1].options.headers.get('X-BS-Token'),
    'token-2',
  );
});

for (const code of [
  'rest_cookie_invalid_nonce',
  'blockstudio_fn_csrf',
  'blockstudio_db_csrf',
]) {
  test(`${code} refreshes once and replays the unchanged request`, async () => {
    const env = setup();
    await env.bs._credentials();
    env.reject(code);
    const response = await env.bs._request('/operation', {
      method: 'PUT',
      body: '{"id":3}',
    });
    assert.equal(response.status, 200);
    assert.equal(env.refreshes(), 2);
    const operations = env.requests.filter(({ url }) => url === '/operation');
    assert.equal(operations.length, 2);
    assert.equal(operations[1].options.body, operations[0].options.body);
    assert.equal(operations[1].options.method, 'PUT');
  });
}

test('ordinary permission failures never retry and repeated CSRF failures stop after one retry', async () => {
  const env = setup();
  await env.bs._credentials();
  env.reject('rest_forbidden');
  assert.equal((await env.bs._request('/operation')).status, 403);
  assert.equal(env.refreshes(), 1);
  env.reject('blockstudio_db_csrf', 3);
  assert.equal((await env.bs._request('/operation')).status, 403);
  assert.equal(env.refreshes(), 2);
  assert.equal(
    env.requests.filter(({ url }) => url === '/operation').length,
    3,
  );
});

test('simultaneous expired requests share their refresh and refresh failures can recover', async () => {
  const env = setup();
  await env.bs._credentials();
  env.reject('blockstudio_fn_csrf', 2);
  const responses = await Promise.all([
    env.bs._request('/one'),
    env.bs._request('/two'),
  ]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(env.refreshes(), 2);
  env.age();
  env.rejectRefresh(true);
  await assert.rejects(env.bs._request('/operation'), /refresh failed/);
  env.rejectRefresh(false);
  assert.equal((await env.bs._request('/operation')).status, 200);
});
