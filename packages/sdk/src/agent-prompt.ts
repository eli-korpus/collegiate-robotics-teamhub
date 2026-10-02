/**
 * The prompt teams paste into an AI coding assistant (Claude Code, Cursor, Copilot, ChatGPT…) to customize their fork.
 * One source of truth: shown on the wizard's last step and in Admin > AI assistant, and (with placeholders) in AGENTS.md.
 * tests/scripts/agents.test.ts checks AGENTS.md still contains the generic version.
 */
export interface AgentPromptInput {
  programName: string;
  /** Names of the enabled tabs, e.g. ["Calendar", "Tasks"]. */
  tabs: string[];
}

export const AGENT_PROMPT_PLACEHOLDER: AgentPromptInput = { programName: '<your program name>', tabs: ['<your tabs>'] };

export function agentPrompt({ programName, tabs }: AgentPromptInput): string {
  return `You are helping ${programName}, a FIRST Tech Challenge robotics program, customize our TeamHub FTC dashboard. TeamHub is an open-source React + Supabase web app, and our copy is a fork on GitHub. Many of us are students, so explain things clearly.

Before changing anything:
1. Read AGENTS.md at the root of the repository. It explains how the code is organized and the rules that keep the dashboard working and safe.
2. Read team/teamhub.config.json to see our setup. Our tabs: ${tabs.length ? tabs.join(', ') : 'none yet'}.

How to work:
- Explain your plan in plain language and wait for my OK before making big changes.
- Make the smallest change that does what we asked. If the setup wizard (npm run setup) can already do it, tell me that instead of editing code.
- Never edit files in apps/dashboard/src/generated/. They are rebuilt from our config.
- Database changes go in a new numbered migration file. Never edit or delete an existing migration. Every table needs row-level security policies.
- Never put secrets (the Supabase service-role key, access tokens, passwords) in the repository.
- Do not add chat or private messages between users (youth protection).
- Use Lucide icons only. No emojis in the interface.
- When you're done, run npm run typecheck, npm run lint and npm test, and fix anything that fails.
- Tell me which files you changed, whether the database needs updating (npm run setup > Update), and how to undo the change.

What we want to change: <describe the change here>`;
}
