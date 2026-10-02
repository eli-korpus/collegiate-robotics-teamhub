/**
 * Secrets stay on this computer (spec §6.2, §15): held in memory for the session; "remember" writes
 * ~/.teamhub/credentials.json with 0600 permissions: outside the repo, never committed.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CRED_DIR = process.env.TEAMHUB_HOME ?? join(homedir(), '.teamhub');
const CRED_FILE = join(CRED_DIR, 'credentials.json');

export interface Creds {
  pat?: string;
  projectRef?: string;
}

let memory: Creds = {};
let loaded = false;

export function getCreds(): Creds {
  if (!loaded) {
    loaded = true;
    try {
      if (existsSync(CRED_FILE)) memory = { ...JSON.parse(readFileSync(CRED_FILE, 'utf8')), ...memory };
    } catch {}
  }
  return memory;
}

export function setCreds(c: Creds, remember: boolean) {
  memory = { ...getCreds(), ...c };
  if (remember) {
    mkdirSync(CRED_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(CRED_FILE, JSON.stringify(memory, null, 2), { mode: 0o600 });
    chmodSync(CRED_FILE, 0o600);
  }
}

export function forgetCreds() {
  memory = {};
  rmSync(CRED_FILE, { force: true });
}

export function rememberedOnDisk(): boolean {
  return existsSync(CRED_FILE);
}
