---
name: chains-debug-deployment
description: Troubleshoot and fix GitHub API deployment failures for large files. Use this when: deploying files to GitHub via API that fail silently or with "Argument list too long" errors, investigating why API calls hang or timeout with large payloads, debugging base64-encoded content deployment issues, or systematically working through GitHub API errors. Handles file size detection, payload splitting, shell argument limits, and file-based API calls. Works for files >5 MB where command-line argument passing fails.
---

# Chains Debug Deployment

When deploying large files to GitHub via the API, command-line argument limits often cause silent failures or cryptic errors. This guide teaches you to diagnose and fix these issues independently.

## Quick Diagnosis: The Three Questions

Before diving into logs, ask:

1. **Is the file large?** (> 5 MB or > 6 MB base64)
   - Check file size: `ls -lh <file>`
   - Check base64 size: `base64 <file> | wc -c`
   - If base64 > 6 MB, argument passing will fail

2. **Are you passing the payload as a CLI argument?**
   - ❌ Bad: `curl -d "{\"content\": \"$(cat huge_b64.txt)\"}" ...`
   - ✓ Good: `curl -d @payload.json ...`
   - If using `$()` or inline strings with large data, you're hitting the shell limit

3. **Did the error say "Argument list too long"?**
   - This error = shell can't fit all your arguments in memory
   - The system limit is typically 128 KB–256 KB for all arguments combined
   - Base64 encoding adds 33% overhead, so a 5 MB file → 6.5+ MB payload

If all three are yes, you've found your problem. Move to **Fix: File-Based Payloads** below.

---

## Systematic Debugging Flow

### Step 1: Check the File Size (Always Start Here)

```bash
# Get actual file size
ls -lh your-file.html

# Calculate base64 size (what actually gets transmitted)
ACTUAL=$(ls -l your-file.html | awk '{print $5}')
B64_SIZE=$((ACTUAL * 4 / 3))  # Rough: base64 is ~33% larger
echo "File: $ACTUAL bytes → Base64: ~$B64_SIZE bytes"

# If B64_SIZE > 6000000 (6 MB), you're at risk
```

**Why this matters:** GitHub API accepts huge payloads fine. The problem is the shell—it can't parse a 12 MB argument. GitHub never sees it.

### Step 2: Identify the Failure Point

Test your deployment step by step:

```bash
TOKEN="your_token"
FILE="your-file.html"
REPO="owner/repo"

# Test 1: Can you get the current SHA?
echo "Test 1: Fetching current SHA..."
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/contents/index.html" | python3 -c "import sys, json; print(json.load(sys.stdin)['sha'])"

# Test 2: Can you encode the file?
echo "Test 2: Encoding file..."
base64 -w0 "$FILE" > /tmp/encoded.txt
echo "Encoded size: $(wc -c < /tmp/encoded.txt) bytes"

# Test 3: Can you build the JSON? (WITHOUT passing it to curl yet)
echo "Test 3: Building JSON payload..."
cat > /tmp/test_payload.json << 'EOF'
{
  "message": "test",
  "content": "dummy_base64_content_here",
  "sha": "current_sha"
}
EOF
echo "Payload structure OK"

# Test 4: Now try the actual deployment
echo "Test 4: Deploying via file-based curl..."
# (See next section for the working version)
```

Each step isolates where the failure occurs. If Test 1–3 pass but Test 4 fails, it's the curl command itself.

### Step 3: Recognize the Actual Error

The error might not say "Argument list too long." Look for:

- **`OSError: [Errno 7]`** — Exact shell argument limit hit
- **No output, curl hangs** — Shell can't even parse the command
- **`Bad request` from GitHub** — Truncated JSON (shell cut it off)
- **Silent success but file wrong** — Partial payload was sent (shell truncated silently)

All of these = same root cause: argument too large.

---

## Fix: File-Based Payloads

Once you know the file is large, use this pattern **every time**:

### Pattern: Write JSON to File, Then Curl It

```bash
TOKEN="github_pat_..."
FILE="Chains Fantasy DGPT App v411.html"
REPO="Bonnaroo/chains-app"

# Step 1: Get current SHA
CURRENT_SHA=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/$REPO/contents/index.html" \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['sha'])")

echo "Current SHA: $CURRENT_SHA"

# Step 2: Encode file
base64 -w0 "$FILE" > /tmp/content_b64.txt
CONTENT=$(cat /tmp/content_b64.txt)

# Step 3: Create JSON file (NOT a string variable)
cat > /tmp/payload.json << EOF
{
  "message": "Deploy v411: add version display to sidebar",
  "content": "$CONTENT",
  "sha": "$CURRENT_SHA"
}
EOF

echo "Payload size: $(du -h /tmp/payload.json | cut -f1)"

# Step 4: Deploy using file reference (the @ is critical)
curl -s -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/payload.json \
  "https://api.github.com/repos/$REPO/contents/index.html" \
  | python3 -c "import sys, json; r = json.load(sys.stdin); print('✓ Deployed:', r['commit']['sha'] if 'commit' in r else 'ERROR: ' + r.get('message', 'unknown'))"
```

**Key insight:** The `@` in `-d @/tmp/payload.json` tells curl to **read from the file**, not parse the argument. The shell never sees the 12 MB string.

### Why This Works

| Approach | Problem | Works? |
|----------|---------|--------|
| `-d "$(cat huge.txt)"` | Shell expands `$()`, hits arg limit | ❌ Fails |
| `-d "{\"content\": \"$HUGE_VAR\"}"` | Shell substitutes variable, exceeds limit | ❌ Fails |
| `-d @huge.json` | curl reads file directly, shell never involved | ✅ Works |

---

## Verification: Confirm Deployment Actually Happened

After deploying, **always verify**:

```bash
# Check GitHub API
curl -s https://api.github.com/repos/Bonnaroo/chains-app/commits/main \
  | python3 -c "import sys, json; d = json.load(sys.stdin); print('Latest commit:', d['commit']['message']); print('SHA:', d['sha'][:10])"

# Check live site has your version marker
curl -s https://bonnaroo.github.io/chains-app/index.html | grep -o "v411" && echo "✓ v411 found on live site"

# Compare file hashes
md5sum /tmp/payload.json
curl -s https://raw.githubusercontent.com/Bonnaroo/chains-app/main/index.html | md5sum
# These won't match (one is base64, one isn't), but you can compare the deployed file to what you expect
```

If the grep finds your version marker, deployment succeeded.

---

## Common Mistakes (And Why They Fail)

### Mistake 1: Using `echo` or `printf` to write JSON

```bash
# ❌ BROKEN
echo "{\"content\": \"$HUGE_B64\"}" > /tmp/payload.json
curl -d @/tmp/payload.json ...  # File exists but JSON is malformed
```

**Why:** echo truncates or escapes special characters. Use a heredoc instead.

### Mistake 2: Forgetting the `@` in curl

```bash
# ❌ BROKEN
curl -d /tmp/payload.json ...  # curl treats this as a string literal, not a file
```

**Why:** curl needs `-d @filename` (with @) to read from file. Without it, curl sends the string "/tmp/payload.json".

### Mistake 3: Intermediate Variables for Huge Content

```bash
# ❌ RISKY
CONTENT=$(base64 -w0 huge-file.html)  # Puts 12 MB in shell variable
curl -d "{\"content\": \"$CONTENT\"}" ...  # Shell tries to parse this monster
```

**Why:** Shell variables consume memory and have size limits. Avoid storing huge base64 strings in variables. Read directly from file instead.

### Mistake 4: Not Checking File Size Upfront

```bash
# ❌ Wastes time debugging
curl -d @payload.json ...  # Fails, you think it's a JSON formatting issue
# Actually it's a 9 MB base64 payload
```

**Why:** Always start by checking file size. If > 5 MB, go straight to file-based approach. Don't waste time on other theories.

---

## Decision Tree: When to Use What

```
Is file < 1 MB (base64 < 2 MB)?
├─ YES: Use inline argument (simpler)
│   curl -d "{\"content\": \"$(base64 -w0 file.html)\"}" ...
│
└─ NO (file > 1 MB):
   Is file < 5 MB (base64 < 6.5 MB)?
   ├─ MAYBE: Could go either way, but safer to use file method
   │
   └─ NO (file > 5 MB): MUST use file method
       cat > /tmp/payload.json << EOF
       {
         "content": "$(base64 -w0 huge-file.html)"
       }
       EOF
       curl -d @/tmp/payload.json ...
```

**Default rule:** If unsure, use file method. It always works.

---

## Python Version (More Reliable for Complex Payloads)

If you're comfortable with Python, this is cleaner and avoids shell quoting issues:

```python
import json
import base64
import subprocess

TOKEN = "your_token"
FILE = "Chains Fantasy DGPT App v411.html"

# Read and encode
with open(FILE, 'rb') as f:
    encoded = base64.b64encode(f.read()).decode()

# Get current SHA
result = subprocess.run([
    'curl', '-s',
    '-H', f'Authorization: Bearer {TOKEN}',
    'https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html'
], capture_output=True, text=True)

data = json.loads(result.stdout)
sha = data['sha']

# Create payload and write to file
payload = {
    "message": "Deploy v411",
    "content": encoded,
    "sha": sha
}

with open('/tmp/deploy.json', 'w') as f:
    json.dump(payload, f)

# Deploy
result = subprocess.run([
    'curl', '-s', '-X', 'PUT',
    '-H', f'Authorization: Bearer {TOKEN}',
    '-H', 'Content-Type: application/json',
    '-d', '@/tmp/deploy.json',
    'https://api.github.com/repos/Bonnaroo/chains-app/contents/index.html'
], capture_output=True, text=True)

response = json.loads(result.stdout)
if 'commit' in response:
    print(f"✓ Deployed: {response['commit']['sha'][:10]}")
else:
    print(f"Error: {response}")
```

Python avoids quoting issues and is less prone to shell-specific bugs.

---

## Lessons Learned Summary

**The core insight:** Shell argument limits are a hard constraint below the application layer. GitHub doesn't reject you—the shell can't even form the request.

**Your new mental model:**
1. Large file detected → file-based deployment mandatory
2. Small file → either method works, inline is simpler
3. Unsure → use file method, it never fails
4. Verify → always grep the live site to confirm

**Next time:** Size the file first, pick the method, execute, verify. Done.

---

## References

- GitHub API docs: https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
- Shell argument limits: `getconf ARG_MAX` (typically 128 KB–256 KB total)
- Base64 overhead: 33% size increase (4 bytes of base64 per 3 bytes of input)
