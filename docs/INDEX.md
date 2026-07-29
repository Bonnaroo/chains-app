# Chains Debugging & Operations Reference

Quick lookup for debugging and deployment issues.

## GitHub API Deployments

### Large File Deployments (>5 MB)
**Problem:** "Argument list too long" errors, silent failures when deploying large files
**File:** docs/CHAINS_DEBUG_DEPLOYMENT.md
**Quick Fix:** Use `curl -d @payload.json` (file-based) instead of inline arguments
**Root Cause:** Shell argument limit (128 KB–256 KB total), not GitHub API issue

### Related Issues
- v411 deployment: Base64 payload 12+ MB exceeded shell limits
- v410 deployment: Successful with file-based payload method

---

## Lessons Learned

### v410: Member Drafting Fix
**File:** docs/LESSONS_LEARNED_v410.md
**Issue:** Members couldn't draft own picks, showed "Read-only" banner
**Fix:** Removed inverted `!isl` gate from permission logic
**Key Learning:** Claude Design download process (three-dot menu)

### v411: Version Display + Deployment
**File:** docs/LESSONS_LEARNED_v411.md
**Issue:** File deployed but didn't contain version display
**Root Cause:** File-based curl argument limit, not file content
**Key Learning:** Large payload → write to temp file, use `curl -d @file`

---

## Debugging Methodology

1. **Check file size first** — Determine if payload > 5 MB (base64)
2. **Identify failure point** — Test each step (SHA, encode, build JSON, deploy)
3. **Recognize the error** — "Argument list too long" = shell limit
4. **Fix with file method** — `curl -d @payload.json` always works
5. **Verify deployment** — `grep` live site for version marker

See CHAINS_DEBUG_DEPLOYMENT.md for full guide.

---

## GitHub Deployment Checklist

- [ ] Check file size: `ls -lh file`
- [ ] Calculate base64: `base64 file | wc -c` (should be < 6 MB if using inline)
- [ ] Get current SHA from GitHub API
- [ ] Encode file to base64
- [ ] Write JSON to temp file (not variable)
- [ ] Deploy: `curl -d @/tmp/payload.json` (with @)
- [ ] Verify: `curl https://live-site | grep version-marker`

---

## For Future Agents

If you encounter a GitHub deployment failure:

1. Read CHAINS_DEBUG_DEPLOYMENT.md first
2. Check file size before wasting time on other theories
3. Use file-based deployment for anything > 1 MB (safer default)
4. Document the issue in a new LESSONS_LEARNED file
5. Commit to GitHub immediately (don't wait for approval)

This is how you learn independently.
