# IQ Trousers — Two-Environment Deployment Guide

## Environments

| Environment | Branch | URL | Password Required |
|---|---|---|---|
| 🟢 **Development** | `develop` | Vercel Preview URL | ❌ No |
| 🔴 **Production** | `main` | employee.iqtrousers.in | ✅ Yes |

---

## How It Works

### For Every New Update

1. **Switch to develop branch:**
   ```bash
   git checkout develop
   ```

2. **Make your changes, then commit & push to Development:**
   ```bash
   git add .
   git commit -m "feat: your change description"
   git push origin develop
   ```
   → Vercel auto-deploys to a **Preview URL** (no password needed).

3. **Review the changes** on the Vercel Preview URL.

4. **Once confirmed, promote to Production:**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   → You will be prompted for the **Production Password**.
   → On correct password → Deploys to **employee.iqtrousers.in** (LIVE).
   → On wrong password → Push is BLOCKED.

---

## Quick Commands

```bash
# Start working on a new update
git checkout develop

# Push to Development (no password)
git push origin develop

# Promote to Production (password required)
git checkout main && git merge develop && git push origin main
```

---

## Password Policy
- Production password is stored as a **SHA-256 hash** in the pre-push Git hook
- The plaintext password is **never** stored in the codebase
- Only the authorised admin (Krish Shah) knows the password

---

> ⚠️ **Never push directly to `main` without testing on `develop` first.**
