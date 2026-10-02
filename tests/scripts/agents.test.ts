import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AGENT_PROMPT_PLACEHOLDER, agentPrompt } from '../../packages/sdk/src/agent-prompt';

describe('AGENTS.md', () => {
  it('contains the same AI assistant prompt the wizard and Admin page show', () => {
    const md = readFileSync('AGENTS.md', 'utf8');
    const block = /<!-- agent-prompt:start -->\n```text\n([\s\S]*?)\n```\n<!-- agent-prompt:end -->/.exec(md)?.[1];
    expect(block).toBe(agentPrompt(AGENT_PROMPT_PLACEHOLDER));
  });
  it('CLAUDE.md points Claude Code at AGENTS.md', () => {
    expect(readFileSync('CLAUDE.md', 'utf8')).toContain('@AGENTS.md');
  });
  it('fills in the program and tabs', () => {
    const p = agentPrompt({ programName: 'Example Robotics', tabs: ['Calendar', 'Tasks'] });
    expect(p).toContain('You are helping Example Robotics');
    expect(p).toContain('Our tabs: Calendar, Tasks.');
  });
});
