import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Bell, IdCard, LayoutGrid, Link2, MessagesSquare, Search, Shield, UserPlus, Users } from 'lucide-react';
import { Button, Dialog, Kbd, ModKey, cn } from '@teamhub/ui';
import { canWith, runtime, useCan, useMe, useToolLink, type LoadedModule } from '@teamhub/sdk';
import { nav } from '../../generated/nav';
import { ProgramLogo } from '../auth/AuthLayout';

const GROUPS: Record<string, { title: string; intro: string }> = {
  team: { title: 'Team', intro: 'Everyday team life: when things happen, who was there, and what needs doing.' },
  engineering: { title: 'Engineering', intro: 'Building the robot: design, code, parts and documenting it all.' },
  competition: { title: 'Competition', intro: 'Competition season: events, scouting and match day.' },
  outreach: { title: 'Outreach & Business', intro: 'Outreach, sponsors and sharing your team with the world.' },
};

interface Step {
  title: string;
  intro: ReactNode;
  body?: ReactNode;
}

/**
 * Welcome tour of this team's dashboard: one step per sidebar group, listing exactly the tabs this program turned on
 * (and that this person can open), then People, your profile and the everyday shortcuts.
 */
export default function Tour({ onClose }: { onClose: () => void }) {
  const me = useMe();
  const go = useNavigate();
  const c = runtime().config;
  const chat = useToolLink('team_chat');
  const canApprove = useCan('people.approve_members');
  const byId = new Map(runtime().modules.filter((m) => !m.manifest.viewPerm || canWith(me, m.manifest.viewPerm)).map((m) => [m.manifest.id, m]));
  const groups = nav.map((g) => ({ ...g, mods: g.items.map((id) => byId.get(id)).filter(Boolean) as LoadedModule[] })).filter((g) => g.mods.length);
  const count = groups.reduce((n, g) => n + g.mods.length, 0);

  const steps: Step[] = [
    {
      title: `Welcome to ${c.program.name}`,
      intro: (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <ProgramLogo size={64} />
          <p className="max-w-md text-[14px] text-muted">
            This is your team's dashboard. Your team chose {count} tab{count === 1 ? '' : 's'} for it. Here's a quick look at each one; it takes about a minute.
          </p>
        </div>
      ),
    },
    ...groups.map((g) => ({
      title: GROUPS[g.category]?.title ?? g.category,
      intro: GROUPS[g.category]?.intro ?? '',
      body: (
        <ul className="space-y-1">
          {g.mods.map((m) => (
            <Row key={m.manifest.id} icon={<m.client.icon />} title={m.manifest.name} text={m.manifest.summary} />
          ))}
        </ul>
      ),
    })),
    {
      title: 'People and your profile',
      intro: `Everyone in ${c.program.name}, and how they reach you.`,
      body: (
        <ul className="space-y-1">
          <Row icon={<IdCard />} title="My profile" text="Your name, photo and details. Each detail says who can see it. Find it in the menu under your name, bottom left." />
          <Row icon={<Users />} title="People" text="Everyone on the team, their roles and positions (like Lead Programmer)." />
          <Row icon={<Link2 />} title="Links" text="The team's tools and resources (chat, Drive, CAD, code) in one place. The main ones also show on Home." />
          {canApprove && <Row icon={<UserPlus />} title="Join requests" text="New members ask to join with the join link. You approve them in People > Requests." />}
          {me.isAdmin && <Row icon={<Shield />} title="Admin" text="Storage, admins, who can join, profile fields and the season." />}
          {chat && <Row icon={<MessagesSquare />} title={chat.label} text="Your team chat, linked at the bottom of the sidebar. TeamHub has no chat of its own." />}
        </ul>
      ),
    },
    {
      title: "You're all set",
      intro: 'A few things that help every day:',
      body: (
        <ul className="space-y-1">
          <Row
            icon={<Search />}
            title="Search"
            text={
              <>
                Find anything, or jump to any tab: press{' '}
                <Kbd>
                  <ModKey />K
                </Kbd>{' '}
                or use the search box at the top of the sidebar.
              </>
            }
          />
          <Row icon={<Bell />} title="Notifications" text="The bell shows things for you: tasks you're given, approvals and changes." />
          <Row icon={<LayoutGrid />} title="Customize Home" text="Choose and order the cards on your Home page with the Customize button." />
        </ul>
      ),
    },
  ];

  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={step.title}
      size="lg"
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-[12px] text-muted">
            {i + 1} of {steps.length}
          </span>
          <span className="flex-1" />
          {i === 0 ? (
            <Button variant="ghost" onClick={onClose}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setI(i - 1)}>
              Back
            </Button>
          )}
          {last ? (
            <>
              <Button
                onClick={() => {
                  onClose();
                  go('/me');
                }}
              >
                Fill in my profile
              </Button>
              <Button variant="primary" onClick={onClose}>
                Start exploring
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setI(i + 1)}>
              {i === 0 ? 'Show me around' : 'Next'} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1" aria-hidden>
          {steps.map((s, n) => (
            <span key={s.title} className={cn('h-1 flex-1 rounded-full', n <= i ? 'bg-accent' : 'bg-border')} />
          ))}
        </div>
        {typeof step.intro === 'string' ? <p className="text-[13.5px] text-muted">{step.intro}</p> : step.intro}
        {step.body}
      </div>
    </Dialog>
  );
}

function Row({ icon, title, text }: { icon: ReactNode; title: string; text: ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-md px-1 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&>svg]:size-[18px]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
    </li>
  );
}
