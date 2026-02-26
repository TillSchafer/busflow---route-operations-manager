#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const FUNCTION_SLUGS = [
  'invite-account-user',
  'platform-provision-account',
  'platform-send-password-reset',
  'platform-delete-account',
  'admin-delete-user-v3',
  'admin-manage-invitation-v1',
  'admin-update-membership-role-v1',
  'admin-update-user-v1',
  'owner-update-account-v1',
  'owner-company-overview-v1',
  'public-register-trial-v1',
  'self-profile-security-v1',
];

const PUBLIC_FUNCTION = 'public-register-trial-v1';

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sep = trimmed.indexOf('=');
    if (sep === -1) continue;
    const key = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function readArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function shortBody(value, max = 220) {
  return String(value ?? '').replace(/\s+/g, ' ').slice(0, max);
}

function expectedForNoAuth(fn) {
  if (fn === PUBLIC_FUNCTION) return [400, 403];
  return [401];
}

function expectedForAnonBearer(fn) {
  if (fn === PUBLIC_FUNCTION) return [400, 403];
  return [401];
}

async function request(url, init) {
  try {
    const response = await fetch(url, init);
    const body = await response.text();
    return { ok: true, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const envArg = readArgValue('--env-file');
  const outArg = readArgValue('--out');

  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));
  if (envArg) loadEnvFile(path.resolve(envArg));

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
    process.exit(2);
  }

  const startedAt = new Date().toISOString();
  const results = [];

  for (const fn of FUNCTION_SLUGS) {
    const url = `${supabaseUrl}/functions/v1/${fn}`;
    console.log(`=== ${fn} ===`);

    const optionsRes = await request(url, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type,apikey',
      },
    });
    console.log(`OPTIONS status=${optionsRes.status} body=${shortBody(optionsRes.body)}`);

    const noAuthRes = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    console.log(`POST noauth status=${noAuthRes.status} body=${shortBody(noAuthRes.body)}`);

    const anonRes = await request(url, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    console.log(`POST anonBearer status=${anonRes.status} body=${shortBody(anonRes.body)}`);

    const optionsPass = optionsRes.ok && optionsRes.status === 200;
    const noAuthPass = noAuthRes.ok && expectedForNoAuth(fn).includes(noAuthRes.status);
    const anonPass = anonRes.ok && expectedForAnonBearer(fn).includes(anonRes.status);
    const overallPass = optionsPass && noAuthPass && anonPass;

    results.push({
      function: fn,
      url,
      options: {
        status: optionsRes.status,
        body: shortBody(optionsRes.body, 300),
        pass: optionsPass,
      },
      postNoAuth: {
        status: noAuthRes.status,
        body: shortBody(noAuthRes.body, 300),
        pass: noAuthPass,
        expected: expectedForNoAuth(fn),
      },
      postAnonBearer: {
        status: anonRes.status,
        body: shortBody(anonRes.body, 300),
        pass: anonPass,
        expected: expectedForAnonBearer(fn),
      },
      pass: overallPass,
    });
  }

  const publicInvalid = await request(`${supabaseUrl}/functions/v1/public-register-trial-v1`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fullName: 'Test User',
      companyName: 'Test Co',
      email: 'invalid-email',
      honeypot: '',
    }),
  });
  console.log(
    `public-register-invalid-email status=${publicInvalid.status} body=${shortBody(publicInvalid.body)}`
  );

  const selfUnknown = await request(`${supabaseUrl}/functions/v1/self-profile-security-v1`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'UNKNOWN' }),
  });
  console.log(
    `self-profile-unknown-action-with-anon status=${selfUnknown.status} body=${shortBody(selfUnknown.body)}`
  );

  const additionalChecks = {
    publicInvalidEmail: {
      status: publicInvalid.status,
      body: shortBody(publicInvalid.body, 300),
      expected: [400, 403],
      pass: publicInvalid.ok && [400, 403].includes(publicInvalid.status),
    },
    selfUnknownActionWithAnon: {
      status: selfUnknown.status,
      body: shortBody(selfUnknown.body, 300),
      expected: [401],
      pass: selfUnknown.ok && [401].includes(selfUnknown.status),
    },
  };

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    projectUrl: supabaseUrl,
    functionCount: FUNCTION_SLUGS.length,
    results,
    additionalChecks,
    allPassed:
      results.every((entry) => entry.pass) &&
      additionalChecks.publicInvalidEmail.pass &&
      additionalChecks.selfUnknownActionWithAnon.pass,
  };

  if (outArg) {
    const outPath = path.resolve(outArg);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`Wrote report to ${outPath}`);
  }

  if (!report.allPassed) {
    console.error('Smoke checks failed.');
    process.exit(1);
  }

  console.log('Smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
