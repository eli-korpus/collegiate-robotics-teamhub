# Email (SMTP)

TeamHub works without email. New members ask to join, a captain or mentor approves them, and if someone forgets their
password, a mentor or admin makes them a reset link from their profile in **People**.

Turning email on adds two things:

- **Email confirmation:** new members click a link in an email before they can sign in, so you know the address is
  really theirs.
- **"Forgot your password?"** on the sign-in page: people reset their own password by email.

## Why you need an email provider

Supabase (where your TeamHub data lives) can send email by itself, but its built-in email only reaches people on your
own Supabase account and is limited to a few emails an hour. To email your team, connect a free **email provider**
(SMTP). TeamHub then sends through it.

## 1. Pick a provider

All of these have a free plan that's plenty for a robotics team.

| Provider | Free plan | Needs your own domain? | Good for |
|---|---|---|---|
| [Brevo](https://www.brevo.com) | 300 emails a day | No (verify one sender address) | Most teams. Easiest without a website domain. |
| Gmail or Google Workspace | About 500 a day | No | A team Gmail account. Needs 2-Step Verification and an app password. |
| [Resend](https://resend.com) | 3,000 a month (100 a day) | Yes | Teams that own a domain, like `ourrobotics.org`. |
| Your school's email server | Varies | No | Ask your school's IT. |

Use a **team account**, not a student's personal one, so it keeps working when people graduate. A mentor should own it.

### Brevo

1. Create a free account at brevo.com.
2. **Senders, Domains & Dedicated IPs > Senders > Add a sender**: add the address emails should come from (for example
   `robotics@yourschool.org`) and confirm it from the email Brevo sends you.
3. **SMTP & API > SMTP** (top right menu, under your account name): note the **SMTP server** (`smtp-relay.brevo.com`),
   **port** (`587`) and **login** (ends in `@smtp-brevo.com`). Click **Generate a new SMTP key** and copy it. That
   key is the password.

### Gmail or Google Workspace

1. Sign in to the team's Google account. Turn on **2-Step Verification** (Google Account > Security).
2. Google Account > Security > **App passwords** (or search "App passwords" in your account settings). Create one
   named "TeamHub" and copy the 16 letters. That's the password, not your normal one.
3. Server `smtp.gmail.com`, port `465`, username: the full Gmail address. Send from the same address.

School Google accounts often have app passwords turned off. Ask your IT department, or use Brevo.

### Resend

1. Create an account at resend.com and add your domain under **Domains**. Add the DNS records it shows (whoever
   manages your domain can do this), then wait for it to say **Verified**.
2. **API Keys > Create API key** with "Sending access". Copy it (starts with `re_`). That's the password.
3. Server `smtp.resend.com`, port `465`, username `resend`. Send from an address at your domain.

## 2. Add it in the setup wizard

1. On your computer, open your TeamHub folder and run `npm run setup`.
2. Choose **Email**.
3. **1. Email provider:** pick your provider and fill in the server, port, username, password (or key), the address
   emails come from and a sender name (what people see in their inbox, like your program name). Click
   **Save provider**.

   The password goes straight to your Supabase project. It isn't saved on your computer or in your GitHub
   repository, so it never ends up on your website. To change the provider later, click **Change**. Leave the password
   blank to keep the saved one.
4. **2. Turn it on:** switch on **Email confirmation & self-serve password reset**, click **Save**, then **Publish to
   your website** so the sign-in page shows "Forgot your password?".

The wizard won't turn email on until a provider is saved, because new members couldn't get their confirmation email
and couldn't join. The same goes for every other wizard step that saves sign-in settings: if your settings have email
on but the Supabase project has no provider (for example after moving to a new project with Import), email
confirmation stays off and the wizard tells you to add a provider in wizard home > Email.

### Or set it up in Supabase yourself

You can also enter the provider in the Supabase dashboard: your project > **Authentication > Emails > SMTP Settings**,
turn on **Enable custom SMTP** and fill in the same details. Then run the setup wizard > **Email** to turn email on
(step 4 above). The wizard shows the provider you saved there.

## 3. Test it

1. Open your site in a private (incognito) window and click **Forgot your password?** on the sign-in page with your
   own email. The reset email should arrive within a minute.
2. Ask a new member to join. They see "Check your email" after they submit, and sign in after clicking the link.
   Then approve them in **People** as usual.

## Limits

Supabase allows **30 emails an hour** once a provider is connected (the wizard sets this). If your whole team joins
at once at a meeting and some emails are slow, raise it in Supabase: **Authentication > Rate Limits > Rate limit for
sending emails**. Your provider's own daily limit (above) still applies.

## Troubleshooting

- **No email arrives:** check spam. In Supabase, **Authentication > Logs** (or **Logs > Auth**) shows the error from
  your provider. Most problems are a wrong password or key, or a "send from" address the provider hasn't verified.
- **"Error sending confirmation email" when someone joins:** the provider rejected the email. Check the logs as above,
  fix the provider in the wizard, and ask them to join again.
- **The email link opens the wrong site (or `localhost`):** in the setup wizard, run the **Host it** step again with
  your site's address, or in Supabase set **Authentication > URL Configuration > Site URL** to your site.
- **"Email not confirmed" when signing in:** the sign-in page offers **Send it again**.
- **Turning email off:** setup wizard > Email > switch off > Save > Publish. Everyone who already has an account keeps
  it. Mentors go back to making reset links from People.

## Customizing the emails

Supabase writes the confirmation and reset emails. To change their wording, edit them in Supabase:
**Authentication > Emails > Templates**. Keep the `{{ .ConfirmationURL }}` link in each one.
