# Make this your profile (easy)

**You need:** GitHub username, and a repo named the **same** as that username.

## Do this

1. Open this repo → green **Use this template** → name the new repo **exactly** your username (example: `bob` makes `bob/bob`). Keep it **Public**.
2. Fill your [profile](https://github.com/settings/profile): name, bio, location, social links.
3. Wait ~1–2 minutes. Cards refresh **by themselves** (Actions runs on the first push). Then open `https://github.com/<you>`.

That’s it.

---

### If cards still show someone else’s face

1. Open your new repo → **Actions** tab  
2. If GitHub asks, click **I understand my workflows, go ahead and enable them**  
3. Left: **Refresh profile cards** → **Run workflow** → **Run workflow**  
4. Wait for green check, refresh your profile page

### Owner tip

Turn on **Settings → General → Template repository** so the green button appears for others.

### Local (optional)

```bash
PROFILE_USERNAME=your-username node scripts/refresh-cards.mjs
```
