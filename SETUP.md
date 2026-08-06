# Use this as your GitHub profile

Zero config. No script edits. Cards pull from **your** GitHub profile.

## Requirements

- Repo name **must equal** your GitHub username (`alice/alice`)
- [GitHub Actions](https://docs.github.com/en/actions) enabled on the repo
- Profile fields filled (name, bio, location, social accounts) — refresh reads these

## Steps

1. On the template repo → **Use this template** → create a new repository named **exactly** your username.
2. Edit your [GitHub profile](https://github.com/settings/profile): name, bio, location, and social links (these become hero / About / Connect).
3. **Actions** → **Refresh profile cards** → **Run workflow**. Wait for it to finish, then open `https://github.com/<you>`.

Daily refresh runs automatically. Re-run the workflow anytime after you change profile data.

## Local refresh (optional)

```bash
PROFILE_USERNAME=your-username node scripts/refresh-cards.mjs
```

In GitHub Actions, username comes from `GITHUB_REPOSITORY` automatically.

## Template owners

Repo **Settings → General → Template repository** = ON so others can click **Use this template**.
