/** SVG gamepad with the mapped action next to each control (spec §13.18). */
export const CONTROLS = [
  'left_stick', 'right_stick', 'left_stick_button', 'right_stick_button', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right',
  'a', 'b', 'x', 'y', 'left_bumper', 'right_bumper', 'left_trigger', 'right_trigger', 'back', 'start',
] as const;
export type Control = (typeof CONTROLS)[number];
export const CONTROL_LABEL: Record<Control, string> = {
  left_stick: 'Left stick', right_stick: 'Right stick', left_stick_button: 'Left stick click', right_stick_button: 'Right stick click',
  dpad_up: 'D-pad up', dpad_down: 'D-pad down', dpad_left: 'D-pad left', dpad_right: 'D-pad right',
  a: 'A / ✕', b: 'B / ○', x: 'X / □', y: 'Y / △', left_bumper: 'Left bumper', right_bumper: 'Right bumper',
  left_trigger: 'Left trigger', right_trigger: 'Right trigger', back: 'Back / Share', start: 'Start / Options',
};

// Positions of each control's dot on a 400×220 controller drawing, and which side its label goes on.
const POS: Record<Control, [number, number, 'l' | 'r']> = {
  left_trigger: [110, 18, 'l'], left_bumper: [110, 38, 'l'], right_trigger: [290, 18, 'r'], right_bumper: [290, 38, 'r'],
  dpad_up: [110, 108, 'l'], dpad_left: [92, 126, 'l'], dpad_down: [110, 144, 'l'], dpad_right: [128, 126, 'l'],
  left_stick: [150, 90, 'l'], left_stick_button: [150, 104, 'l'], right_stick: [250, 140, 'r'], right_stick_button: [250, 154, 'r'],
  y: [290, 80, 'r'], x: [272, 98, 'r'], b: [308, 98, 'r'], a: [290, 116, 'r'], back: [180, 72, 'l'], start: [220, 72, 'r'],
};

export function Gamepad({ map, title }: { map: Partial<Record<Control, string>>; title: string }) {
  const used = CONTROLS.filter((c) => map[c]);
  const left = used.filter((c) => POS[c][2] === 'l').sort((a, b) => POS[a][1] - POS[b][1]);
  const right = used.filter((c) => POS[c][2] === 'r').sort((a, b) => POS[a][1] - POS[b][1]);
  const labelY = (i: number, n: number) => 20 + (i * 190) / Math.max(1, n - 1 || 1);
  return (
    <figure className="overflow-x-auto">
      <svg viewBox="-170 0 740 240" className="w-full min-w-[520px]" role="img" aria-label={`${title} mapping`}>
        <path d="M110 50 Q200 30 290 50 L330 60 Q380 80 370 170 Q360 220 320 200 L270 170 Q200 160 130 170 L80 200 Q40 220 30 170 Q20 80 70 60 Z" fill="var(--bg-subtle)" stroke="var(--border-strong)" strokeWidth="2" />
        <circle cx="150" cy="97" r="18" fill="var(--surface)" stroke="var(--border-strong)" />
        <circle cx="250" cy="147" r="18" fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x="100" y="98" width="20" height="56" rx="3" fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x="82" y="116" width="56" height="20" rx="3" fill="var(--surface)" stroke="var(--border-strong)" />
        {(['y', 'x', 'b', 'a'] as Control[]).map((c) => (
          <circle key={c} cx={POS[c][0]} cy={POS[c][1]} r="9" fill="var(--surface)" stroke="var(--border-strong)" />
        ))}
        {used.map((c) => (
          <circle key={c} cx={POS[c][0]} cy={POS[c][1]} r="4" fill="var(--accent)" />
        ))}
        {[left, right].map((side, si) =>
          side.map((c, i) => {
            const y = labelY(i, side.length);
            const x = si === 0 ? -160 : 420;
            const [cx, cy] = POS[c];
            return (
              <g key={c}>
                <line x1={cx} y1={cy} x2={si === 0 ? x + 150 : x - 8} y2={y - 4} stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
                <text x={x} y={y} fontSize="11" fill="var(--text)" textAnchor={si === 0 ? 'start' : 'start'}>
                  <tspan fontWeight="600">{CONTROL_LABEL[c]}:</tspan> {map[c]!.slice(0, 26)}
                </text>
              </g>
            );
          }),
        )}
      </svg>
      <figcaption className="text-center text-[12px] text-muted">{title}</figcaption>
    </figure>
  );
}
