# Lessons Learned: Chains v411 Deployment Issue

**Date:** July 28, 2026  
**Version:** v411 (Version Display)  
**Live Commit:** 58ccc983915fdf11f085561b7cbcba2bad7a15e9  
**Status:** ✓ Deployed and verified

---

## What Broke

v411 was downloaded from Claude Design with the version display feature ("v411" text in sidebar), but when attempting to deploy via GitHub API, the deployment appeared to hang or fail silently.

---

## Root Cause

**The Problem:** Shell argument length limit exceeded.

When deploying large files (9.2 MB HTML → 12+ MB base64 encoded), passing the entire JSON payload as a command-line argument to `curl` exceeded the system's maximum argument length:

```
OSError: [Errno 7] Argument list too long: 'curl'
```

This happened at the GitHub API step where we tried to pass the massive base64-encoded content directly in the curl command:

```bash
# BROKEN: Passing base64 payload as CLI argument
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -d "{\"message\": \"...\", \"content\": \"[12MB base64 string]\", \"sha\": \"...\"}" \
  "https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html"
```

The shell couldn't handle the argument size.

---

## The Fix

**Write the JSON payload to a temporary file, then use `curl -d @filename`:**

```bash
# FIXED: Write payload to file, let curl read from file
cat > /tmp/deploy_payload.json << EOF
{
  "message": "Deploy v411: add version display to sidebar",
  "content": "[12MB base64 string]",
  "sha": "current_sha_here"
}
EOF

curl -s -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/deploy_payload.json \
  "https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html"
```

The `@` prefix tells `curl` to read the payload from a file instead of parsing it from the command line. This bypasses the shell's argument length limit entirely.

---

## Correct Deployment Process for Large Files

When deploying any file larger than ~5 MB:

### 1. Get Current SHA
```bash
CURRENT_SHA=$(curl -s -H "Authorization: Bearer TOKEN" \
  "https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['sha'])")
```

### 2. Base64 Encode File
```bash
base64 -w0 "Chains Fantasy DGPT App v411.html" > /tmp/content_b64.txt
```

### 3. Create Payload File (NOT command-line arg)
```bash
cat > /tmp/deploy.json << EOF
{
  "message": "Deploy v411: add version display to sidebar",
  "content": "$(cat /tmp/content_b64.txt)",
  "sha": "$CURRENT_SHA"
}
EOF
```

### 4. Deploy Using File (NOT string)
```bash
curl -s -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/deploy.json \
  "https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html"
```

### 5. Verify Deployment
```bash
curl -s "https://bonnaroo.github.io/chains-app/index.html" | grep "v411"
```

---

## Key Lesson: File I/O Over CLI Args

For any deployment where:
- File size > 5 MB
- Base64 encoded content > 6 MB
- JSON payload > 8 MB

**Always write to a temp file and use `-d @filename`**, never pass the data as a command-line argument.

The shell has hard limits on argument size (typically 128 KB–256 KB argument list total). Base64 encoding expands size by 33%, so even moderately large files exceed CLI limits.

---

## Testing Checklist

✓ v411 downloaded from Design  
✓ File size verified (9.2 MB)  
✓ Base64 encoding attempted (failed with arg limit)  
✓ Switched to file-based deployment  
✓ GitHub API accepted payload  
✓ Commit created: 58ccc983915fdf11f085561b7cbcba2bad7a15e9  
✓ Live site verified: "v411" text present  

---

## For Next Time

1. **Always check file size before deployment.** If > 5 MB, use file-based curl (`-d @file`).
2. **Don't pass large base64 as CLI arguments.** The shell will reject it silently or with unclear error messages.
3. **Verify live immediately after deploy.** `curl https://bonnaroo.github.io/chains-app/index.html | grep "v411"` confirms it went live.
4. **GitHub API accepts the file, but shell arg limit is the bottleneck**, not GitHub itself.

---

## Files Modified

- `Chains Fantasy DGPT\LESSONS_LEARNED_v411.md` (this file)  
- `index.html` on Bonnaroo/chains-app (live deployment)  

---

## Status: Complete ✓

- v411 downloaded: ✓
- Deployment issue diagnosed: ✓  
- Fix applied (file-based payload): ✓  
- v411 deployed: ✓  
- Live verified: ✓  
- Ledgestone Open (July 30) ready: ✓
