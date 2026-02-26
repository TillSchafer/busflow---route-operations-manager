#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
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

function short(value, max = 240) {
  return String(value ?? '').replace(/\s+/g, ' ').slice(0, max);
}

async function signInWithPassword({ supabaseUrl, anonKey, email, password }) {
  const endpoint = `${supabaseUrl}/auth/v1/token?grant_type=password`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.access_token) {
    throw new Error(`Sign-in failed for ${email}: ${short(body?.msg || body?.error_description || body?.error || response.status)}`);
  }
  return body.access_token;
}

async function callFunction({ supabaseUrl, anonKey, functionName, token, payload }) {
  const endpoint = `${supabaseUrl}/functions/v1/${functionName}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

function buildMatrix() {
  return [
    {
      id: 'owner-overview-owner',
      role: 'owner',
      functionName: 'owner-company-overview-v1',
      payload: {},
      expectedStatuses: [200],
      requiresMutation: false,
    },
    {
      id: 'owner-overview-viewer-forbidden',
      role: 'viewer',
      functionName: 'owner-company-overview-v1',
      payload: {},
      expectedStatuses: [401, 403],
      requiresMutation: false,
    },
    {
      id: 'team-role-change-admin',
      role: 'account_admin',
      functionName: 'admin-update-membership-role-v1',
      payloadEnv: 'E2E_PAYLOAD_ADMIN_UPDATE_MEMBERSHIP_ROLE',
      expectedStatuses: [200],
      requiresMutation: true,
    },
    {
      id: 'team-role-change-viewer-forbidden',
      role: 'viewer',
      functionName: 'admin-update-membership-role-v1',
      payloadEnv: 'E2E_PAYLOAD_ADMIN_UPDATE_MEMBERSHIP_ROLE',
      expectedStatuses: [401, 403],
      requiresMutation: true,
    },
    {
      id: 'self-profile-email-change',
      role: 'dispatch',
      functionName: 'self-profile-security-v1',
      payload: { action: 'REQUEST_EMAIL_CHANGE', newEmail: 'replace-me@example.invalid' },
      expectedStatuses: [200, 400, 409],
      requiresMutation: true,
      notes: 'Use disposable inbox in staging and override payload via E2E_PAYLOAD_SELF_PROFILE_EMAIL_CHANGE.',
    },
    {
      id: 'self-profile-password-reset',
      role: 'dispatch',
      functionName: 'self-profile-security-v1',
      payload: { action: 'REQUEST_PASSWORD_RESET' },
      expectedStatuses: [200],
      requiresMutation: true,
    },
  ];
}

function resolveRoleCredentials() {
  return {
    owner: {
      email: process.env.E2E_OWNER_EMAIL,
      password: process.env.E2E_OWNER_PASSWORD,
    },
    platform_admin: {
      email: process.env.E2E_PLATFORM_ADMIN_EMAIL,
      password: process.env.E2E_PLATFORM_ADMIN_PASSWORD,
    },
    account_admin: {
      email: process.env.E2E_ACCOUNT_ADMIN_EMAIL,
      password: process.env.E2E_ACCOUNT_ADMIN_PASSWORD,
    },
    dispatch: {
      email: process.env.E2E_DISPATCH_EMAIL,
      password: process.env.E2E_DISPATCH_PASSWORD,
    },
    viewer: {
      email: process.env.E2E_VIEWER_EMAIL,
      password: process.env.E2E_VIEWER_PASSWORD,
    },
  };
}

function parsePayloadFromEnv(varName, fallbackPayload) {
  if (!varName) return fallbackPayload ?? {};
  const raw = process.env[varName];
  if (!raw) return fallbackPayload ?? {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${varName} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));
  const envArg = readArgValue('--env-file');
  if (envArg) loadEnvFile(path.resolve(envArg));

  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
  }

  const allowMutations = (process.env.E2E_ALLOW_MUTATIONS || '').toLowerCase() === 'true';
  const outArg = readArgValue('--out');
  const credentials = resolveRoleCredentials();
  const matrix = buildMatrix();

  const tokens = {};
  for (const [role, creds] of Object.entries(credentials)) {
    if (!creds.email || !creds.password) continue;
    tokens[role] = await signInWithPassword({
      supabaseUrl,
      anonKey,
      email: creds.email,
      password: creds.password,
    });
  }

  const results = [];
  for (const testCase of matrix) {
    const token = tokens[testCase.role];
    if (!token) {
      results.push({
        ...testCase,
        skipped: true,
        reason: `Missing credentials for role: ${testCase.role}`,
      });
      continue;
    }
    if (testCase.requiresMutation && !allowMutations) {
      results.push({
        ...testCase,
        skipped: true,
        reason: 'Mutation test skipped (E2E_ALLOW_MUTATIONS=true required).',
      });
      continue;
    }

    const payload = parsePayloadFromEnv(testCase.payloadEnv, testCase.payload);
    const response = await callFunction({
      supabaseUrl,
      anonKey,
      functionName: testCase.functionName,
      token,
      payload,
    });
    const pass = testCase.expectedStatuses.includes(response.status);
    results.push({
      id: testCase.id,
      role: testCase.role,
      functionName: testCase.functionName,
      expectedStatuses: testCase.expectedStatuses,
      actualStatus: response.status,
      responseBody: short(response.body, 320),
      pass,
      skipped: false,
      notes: testCase.notes || undefined,
    });
  }

  const report = {
    startedAt: new Date().toISOString(),
    supabaseUrl,
    allowMutations,
    results,
    passed: results.filter((r) => !r.skipped).every((r) => r.pass),
    skippedCount: results.filter((r) => r.skipped).length,
  };

  if (outArg) {
    const outPath = path.resolve(outArg);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
