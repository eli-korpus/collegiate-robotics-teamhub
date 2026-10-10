import type { ComponentType } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronsDown, CircleDot, Joystick, Menu, PanelTop, Square } from 'lucide-react';

/** Gamepad mapping laid out like the controller's two halves, with Lucide icons per control (spec §13.18). */
export const CONTROLS = [
  'left_stick', 'right_stick', 'left_stick_button', 'right_stick_button', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right',
  'a', 'b', 'x', 'y', 'left_bumper', 'right_bumper', 'left_trigger', 'right_trigger', 'back', 'start',
] as const;
export type Control = (typeof CONTROLS)[number];
export const CONTROL_LABEL: Record<Control, string> = {
  left_stick: 'Left stick', right_stick: 'Right stick', left_stick_button: 'Left stick click', right_stick_button: 'Right stick click',
  dpad_up: 'D-pad up', dpad_down: 'D-pad down', dpad_left: 'D-pad left', dpad_right: 'D-pad right',
  a: 'A (Cross)', b: 'B (Circle)', x: 'X (Square)', y: 'Y (Triangle)', left_bumper: 'Left bumper', right_bumper: 'Right bumper',
  left_trigger: 'Left trigger', right_trigger: 'Right trigger', back: 'Back / Share', start: 'Start / Options',
};

type Icon = ComponentType<{ className?: string }>;
/** Face buttons show their letter; everything else uses an icon from the Lucide set. */
const ICON: Partial<Record<Control, Icon>> = {
  left_trigger: ChevronsDown, right_trigger: ChevronsDown, left_bumper: PanelTop, right_bumper: PanelTop,
  left_stick: Joystick, right_stick: Joystick, left_stick_button: CircleDot, right_stick_button: CircleDot,
  dpad_up: ArrowUp, dpad_down: ArrowDown, dpad_left: ArrowLeft, dpad_right: ArrowRight, back: Square, start: Menu,
};
const LEFT: Control[] = ['left_trigger', 'left_bumper', 'left_stick', 'left_stick_button', 'dpad_up', 'dpad_down', 'dpad_left', 'dpad_right', 'back'];
const RIGHT: Control[] = ['right_trigger', 'right_bumper', 'y', 'x', 'b', 'a', 'right_stick', 'right_stick_button', 'start'];

function ControlRow({ c, action }: { c: Control; action: string }) {
  const I = ICON[c];
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-bg-subtle text-[12px] font-semibold text-muted">
        {I ? <I className="size-4" /> : c.toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] text-faint">{CONTROL_LABEL[c]}</span>
        <span className="block truncate text-[13px] font-medium">{action}</span>
      </span>
    </li>
  );
}

export function Gamepad({ map, title }: { map: Partial<Record<Control, string>>; title: string }) {
  const side = (list: Control[]) => list.filter((c) => map[c]).map((c) => <ControlRow key={c} c={c} action={map[c]!} />);
  return (
    <figure className="rounded-lg border border-border bg-surface p-4" aria-label={`${title} mapping`}>
      <figcaption className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{title}</figcaption>
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        <ul className="divide-y divide-border">{side(LEFT)}</ul>
        <ul className="divide-y divide-border">{side(RIGHT)}</ul>
      </div>
    </figure>
  );
}
