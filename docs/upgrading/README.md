# Upgrade guides for major versions

Patch and minor updates need no guide: `npm run setup` > Update handles them. Each **major** version (2.0.0, 3.0.0…)
gets a guide here named after its major number (`v2.md`, `v3.md`). The setup wizard links to it and asks admins to
confirm they've read it before updating.

## Template

```markdown
# Upgrading to TeamHub N

## Before you start
- What changes for the team, in plain words (what moved, what was removed and what replaces it).
- Anything to do *before* updating (e.g. export something, finish a season).

## What the update does
- Database changes, including anything removed (with the data kept in your pre-update backup).
- Settings that changed meaning, and what the wizard does with your old values.

## After updating
- Anything admins should check or redo.
- Customizations most likely to need attention (files that changed a lot).

## Going back
- Whether "Undo this update" works for this version, and how to restore from the backup if not.
```
