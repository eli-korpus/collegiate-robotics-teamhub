import { useModuleSettings, useRows } from '@teamhub/sdk';

export interface Battery {
  id: string;
  team_id: string | null;
  label: string;
  type: string | null;
  purchased: string | null;
  retired: boolean;
  notes: string | null;
}
export interface BatLog {
  id: number;
  battery_id: string;
  kind: 'charged' | 'tested' | 'used' | 'note';
  voltage: number | null;
  note: string | null;
  at: string;
  by: string | null;
}
export interface BatSettings {
  chargedVolts: number;
  weakVolts: number;
  staleHours: number;
}

export const useBatteries = () => useRows<Battery>(['batteries', 'list'], (sb) => sb.from('bat_batteries').select('*').order('label'));
export const useBatLogs = () => useRows<BatLog>(['batteries', 'logs'], (sb) => sb.from('bat_logs').select('*').order('at', { ascending: false }).limit(2000));
export const useBatSettings = () => useModuleSettings<BatSettings>('batteries');

export type BatState = 'charged' | 'needs_charge' | 'weak' | 'unknown' | 'retired';

/** Derives status from the log: last charge vs. later use, staleness, and the latest voltage after charging. */
export function batteryStatus(b: Battery, logs: BatLog[], s: BatSettings): { state: BatState; voltage: number | null; lastCharged: string | null; cycles: number; volts: number[] } {
  const mine = logs.filter((l) => l.battery_id === b.id);
  const volts = mine.filter((l) => l.voltage != null).map((l) => Number(l.voltage)).reverse();
  const voltage = volts.length ? volts[volts.length - 1] : null;
  const lastCharge = mine.find((l) => l.kind === 'charged');
  const lastUse = mine.find((l) => l.kind === 'used');
  const cycles = mine.filter((l) => l.kind === 'charged').length;
  if (b.retired) return { state: 'retired', voltage, lastCharged: lastCharge?.at ?? null, cycles, volts };
  const latestTestAfterCharge = lastCharge ? mine.find((l) => l.voltage != null && l.at >= lastCharge.at) : undefined;
  let state: BatState = 'unknown';
  if (lastCharge) {
    const usedSince = lastUse && lastUse.at > lastCharge.at;
    const stale = Date.now() - new Date(lastCharge.at).getTime() > s.staleHours * 3_600_000;
    state = usedSince || stale ? 'needs_charge' : 'charged';
    if (latestTestAfterCharge && Number(latestTestAfterCharge.voltage) < s.weakVolts && !usedSince) state = 'weak';
    else if (latestTestAfterCharge && Number(latestTestAfterCharge.voltage) < s.chargedVolts && state === 'charged') state = 'needs_charge';
  } else if (voltage != null) state = voltage >= s.chargedVolts ? 'charged' : 'needs_charge';
  return { state, voltage, lastCharged: lastCharge?.at ?? null, cycles, volts };
}

export const STATE_LABEL: Record<BatState, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  charged: { label: 'Charged', tone: 'success' },
  needs_charge: { label: 'Needs charging', tone: 'warning' },
  weak: { label: 'Weak — consider retiring', tone: 'danger' },
  unknown: { label: 'Unknown', tone: 'neutral' },
  retired: { label: 'Retired', tone: 'neutral' },
};
