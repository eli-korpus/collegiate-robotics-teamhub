# Security policy

TeamHub is used by youth robotics teams, so we take security reports seriously and respond quickly.

## Reporting a vulnerability

Please **don't** open a public issue. Instead, report it privately through GitHub:
**Security > Report a vulnerability** on the [TeamHub repository](https://github.com/elikorpus/teamhub-ftc/security).

Include what's affected, how to reproduce it, and the impact you expect. You'll get a reply within a few days.

## Supported versions

Security fixes go into the newest release. Teams get them through `npm run setup` > Update, and dashboards show
admins a red "Security update available" notice. See [docs/updating.md](docs/updating.md).

## Scope

TeamHub runs on each team's own Supabase project and host. Reports about TeamHub's code, database rules (row-level
security), setup wizard and edge functions are in scope. Issues in Supabase, GitHub or hosting providers themselves
should go to those companies.
