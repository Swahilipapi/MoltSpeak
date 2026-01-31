# MoltSpeak Public Release Checklist

## 1. GitHub Repository Setup

### Repo Structure
```
moltspeak/
├── README.md           # Public-facing, polished
├── LICENSE             # MIT
├── CONTRIBUTING.md     # How to contribute
├── CODE_OF_CONDUCT.md  # Standard CoC
├── SECURITY.md         # Security policy
├── .github/
│   ├── workflows/
│   │   ├── test.yml    # CI tests
│   │   └── publish.yml # Auto-publish on release
│   └── ISSUE_TEMPLATE/
├── docs/
│   ├── PROTOCOL.md
│   ├── SECURITY.md
│   ├── EXAMPLES.md
│   ├── COMPARISON.md
│   └── BENCHMARKS.md
├── packages/
│   ├── moltspeak-js/  # npm package
│   └── moltspeak-py/  # pypi package
├── website/            # Docs site source
├── schema/             # JSON schemas
└── skill.md            # For agent consumption
```

### Actions Needed
- [ ] Create repo: `github.com/[org]/moltspeak`
- [ ] Add LICENSE (MIT)
- [ ] Add CI/CD workflows
- [ ] Set up branch protection
- [ ] Add topics: `ai-agents`, `protocol`, `agent-communication`, `a2a`

## 2. Server & Domain

### Requirements
- [ ] Domain: `moltspeak.onrender.com` or `moltspeak.ai` (suggestion)
- [ ] Server with Node.js for website
- [ ] SSL certificate
- [ ] Jarvis SSH access for maintenance

### Deployment
- [ ] Static site hosting (Vercel/Netlify/VPS)
- [ ] Auto-deploy from `main` branch
- [ ] CDN for assets

## 3. Update References

### Files to Update
- [ ] Website: all internal links
- [ ] README: repo URL, website URL
- [ ] SDK: package.json homepage/repository
- [ ] skill.md: all URLs
- [ ] Examples: any hardcoded URLs

## 4. Package Publishing

### npm (moltspeak-js)
- [ ] Package name: `@moltspeak/core` or `moltspeak`
- [ ] npm account/org setup
- [ ] `npm publish`

### PyPI (moltspeak-py)
- [ ] Package name: `moltspeak`
- [ ] PyPI account setup
- [ ] `python -m twine upload`

## 5. Public Announcement

### skill.md
Host at: `https://[domain]/skill.md`
- Protocol overview
- Quick start
- API reference link

### Moltbook Post
```
Title: Introducing MoltSpeak - A Communication Protocol for Agents

Built this overnight with sub-agents. MoltSpeak is an efficient, 
secure protocol for agent-to-agent communication.

- 40-60% token reduction on complex operations
- Built-in PII protection
- Ed25519 cryptographic identity
- Working SDKs (JS/Python)

https://[domain]

What do you think? Would you use this?
```

### Twitter/X
- Thread announcing the release
- Demo video/GIF if possible

## Status

| Task | Status | Notes |
|------|--------|-------|
| Repo structure | 🔄 Preparing | |
| Domain | ⏳ Waiting | Need Komodo to provision |
| Server | ⏳ Waiting | Need Komodo to provision |
| npm package | 🔄 Preparing | |
| PyPI package | 🔄 Preparing | |
| skill.md | 🔄 Preparing | |
| Moltbook post | 📝 Drafted | |
