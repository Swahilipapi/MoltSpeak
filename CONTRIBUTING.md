# Contributing to MoltSpeak

Thank you for your interest in contributing to MoltSpeak! This document provides guidelines and information for contributors.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Ways to Contribute](#ways-to-contribute)
3. [Getting Started](#getting-started)
4. [Development Setup](#development-setup)
5. [Pull Request Process](#pull-request-process)
6. [Reporting Bugs](#reporting-bugs)
7. [Suggesting Features](#suggesting-features)
8. [RFC Process](#rfc-process-for-protocol-changes)
9. [Documentation Standards](#documentation-standards)
10. [Testing Requirements](#testing-requirements)
11. [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to making participation in MoltSpeak a welcoming experience for everyone. We pledge to:

- **Be respectful** - Treat all contributors with respect, regardless of background or experience level
- **Be constructive** - Provide helpful feedback focused on improving the project
- **Be patient** - Remember that contributors have varying levels of experience
- **Be collaborative** - Work together towards shared goals

### Unacceptable Behavior

The following behaviors are not tolerated:

- Harassment, discrimination, or personal attacks
- Trolling or deliberately inflammatory comments
- Publishing others' private information
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Violations may be reported to the maintainers at [conduct@moltspeak.dev]. All reports will be reviewed and investigated. Maintainers have the right to remove, edit, or reject contributions that violate this code of conduct.

---

## Ways to Contribute

There are many ways to contribute to MoltSpeak:

### 🐛 Bug Reports
Found a bug? Report it! See [Reporting Bugs](#reporting-bugs).

### 💡 Feature Suggestions
Have an idea? Share it! See [Suggesting Features](#suggesting-features).

### 📖 Documentation
Improve docs, fix typos, add examples. Documentation PRs are always welcome!

### 🔧 Code Contributions
Fix bugs, implement features, improve performance.

### 🧪 Testing
Add test cases, improve coverage, find edge cases.

### 📢 Advocacy
Write blog posts, give talks, help others learn MoltSpeak.

### 🔍 Code Review
Review pull requests, provide feedback, help others improve their contributions.

---

## Getting Started

### 1. Fork the Repository

```bash
# Fork on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/moltspeak.git
cd moltspeak
```

### 2. Set Up Upstream Remote

```bash
git remote add upstream https://github.com/moltspeak/moltspeak.git
git fetch upstream
```

### 3. Create a Branch

```bash
# Always branch from main
git checkout main
git pull upstream main
git checkout -b your-feature-name
```

### Branch Naming Conventions

| Type | Format | Example |
|------|--------|---------|
| Feature | `feat/description` | `feat/add-streaming-support` |
| Bug Fix | `fix/description` | `fix/signature-verification` |
| Docs | `docs/description` | `docs/improve-examples` |
| RFC | `rfc/number-title` | `rfc/003-capability-extensions` |

---

## Development Setup

### Prerequisites

- **Node.js** 18+ (for JavaScript SDK)
- **Python** 3.10+ (for Python SDK)
- **Rust** 1.70+ (for core libraries, optional)
- **Docker** (for integration tests)

### Repository Structure

```
moltspeak/
├── PROTOCOL.md           # Core protocol specification
├── SECURITY.md           # Security model and threats
├── components/           # Ecosystem component specs
│   ├── identity/         # MoltID specification
│   ├── trust/            # MoltTrust specification
│   ├── relay/            # MoltRelay specification
│   ├── discovery/        # MoltDiscovery specification
│   ├── credits/          # MoltCredits specification
│   ├── governance/       # MoltGovernance specification
│   └── jobs/             # MoltJobs specification
├── sdk/                  # SDK implementations
│   ├── python/           # Python SDK
│   ├── javascript/       # JavaScript/TypeScript SDK
│   └── rust/             # Rust SDK (core)
├── schemas/              # JSON schemas
├── website/              # Documentation website
└── tests/                # Integration tests
```

### Setting Up Python SDK Development

```bash
cd sdk/python

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dev dependencies
pip install -e ".[dev,test,crypto]"

# Run tests
pytest

# Type checking
mypy moltspeak

# Linting
ruff check moltspeak
```

### Setting Up JavaScript SDK Development

```bash
cd sdk/javascript

# Install dependencies
npm install

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Build
npm run build
```

### Running Integration Tests

```bash
# Start test infrastructure
docker-compose -f tests/docker-compose.yml up -d

# Run integration tests
pytest tests/integration/

# Cleanup
docker-compose -f tests/docker-compose.yml down
```

---

## Pull Request Process

### Before Submitting

1. **Ensure tests pass** - All existing tests must pass
2. **Add tests** - New features need tests, bug fixes need regression tests
3. **Update documentation** - Keep docs in sync with code
4. **Follow style guides** - Run linters, format code
5. **Keep PRs focused** - One feature/fix per PR

### Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**

```
feat(protocol): add support for streaming responses

Implements the stream operation as specified in PROTOCOL.md.
Includes support for chunked delivery and backpressure.

Closes #123
```

```
fix(sdk-python): correct signature verification for rotated keys

The previous implementation failed to check the key rotation
timestamp, causing false verification failures.

Fixes #456
```

### Pull Request Template

When you open a PR, please fill out this template:

```markdown
## Description

[Describe your changes]

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues

Closes #[issue number]

## Checklist

- [ ] I have read the [CONTRIBUTING.md](CONTRIBUTING.md) document
- [ ] My code follows the project's style guidelines
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings

## Testing Done

[Describe how you tested your changes]

## Screenshots (if applicable)

[Add screenshots for UI changes]
```

### Review Process

1. **Automated checks** - CI runs tests, linting, type checking
2. **Maintainer review** - At least one maintainer must approve
3. **Address feedback** - Respond to comments, make changes if needed
4. **Merge** - Maintainers will merge when all checks pass

---

## Reporting Bugs

### Before Reporting

1. **Search existing issues** - Someone may have already reported it
2. **Check documentation** - Make sure it's a bug, not expected behavior
3. **Reproduce the issue** - Can you consistently reproduce it?

### Bug Report Template

```markdown
## Bug Description

[A clear and concise description of what the bug is]

## To Reproduce

Steps to reproduce the behavior:
1. [First Step]
2. [Second Step]
3. [Third Step]
4. [See error]

## Expected Behavior

[What you expected to happen]

## Actual Behavior

[What actually happened]

## Environment

- OS: [e.g., macOS 14.0, Ubuntu 22.04, Windows 11]
- SDK Version: [e.g., moltspeak-python 0.3.1]
- Python/Node.js Version: [e.g., Python 3.11, Node.js 20]

## Additional Context

[Any other context about the problem]

## Logs/Screenshots

[If applicable, add logs or screenshots]
```

### Security Vulnerabilities

⚠️ **Do NOT report security vulnerabilities publicly!**

Email security@moltspeak.dev with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will respond within 48 hours and work with you to address the issue responsibly.

---

## Suggesting Features

### Before Suggesting

1. **Search existing issues** - Someone may have already suggested it
2. **Check the roadmap** - It might already be planned
3. **Consider scope** - Does it fit with MoltSpeak's goals?

### Feature Request Template

```markdown
## Feature Description

[A clear and concise description of the feature you'd like]

## Problem/Motivation

[What problem does this solve? Why is it needed?]

## Proposed Solution

[How do you envision this working?]

## Alternatives Considered

[What alternatives have you considered?]

## Use Cases

[Who would use this feature and how?]

## Additional Context

[Any other context, mockups, or examples]
```

---

## RFC Process for Protocol Changes

Changes to the core MoltSpeak protocol or major ecosystem components require an RFC (Request for Comments).

### When is an RFC Required?

- Any change to `PROTOCOL.md`
- New message types or operations
- Changes to security model
- New ecosystem components
- Breaking changes to existing specs

### RFC Process

1. **Draft** - Create an RFC document using the template
2. **Discuss** - Open a discussion in GitHub Discussions
3. **Refine** - Incorporate feedback, iterate on the design
4. **Propose** - Open a PR with the RFC
5. **Review** - Community review period (minimum 2 weeks)
6. **Decide** - Maintainers accept, reject, or request changes
7. **Implement** - Once accepted, implement the RFC

### RFC Template

```markdown
# RFC-XXX: [Title]

## Summary

[One paragraph summary of the proposal]

## Motivation

[Why is this change needed? What problems does it solve?]

## Detailed Design

[The bulk of the RFC. Explain the design in enough detail that:
- Someone familiar with the project can understand it
- Someone familiar can implement it
- Edge cases are considered]

## Drawbacks

[Why should we NOT do this?]

## Alternatives

[What other designs were considered? Why were they not chosen?]

## Unresolved Questions

[What aspects of the design are still TBD?]

## Implementation Plan

[How will this be implemented? Phased rollout?]

## Backward Compatibility

[How does this affect existing implementations?]

## Security Considerations

[Any security implications?]
```

### RFC Numbering

RFCs are numbered sequentially: RFC-001, RFC-002, etc.

Accepted RFCs are stored in `/rfcs/` directory.

---

## Documentation Standards

### General Guidelines

- **Clear and concise** - Avoid jargon, explain terms when necessary
- **Example-driven** - Include code examples for everything
- **Keep it current** - Update docs when code changes
- **Markdown formatting** - Use standard Markdown

### Code Examples

All code examples should be:
- **Complete** - Can be run as-is
- **Correct** - Actually work
- **Annotated** - Include comments explaining key parts

```python
# Good: Complete, correct, annotated
from moltspeak import Agent, MessageBuilder, Operation

# Create an agent with identity
agent = Agent.create("my-agent", "my-org")

# Build a query message
message = (
    MessageBuilder(Operation.QUERY)
    .from_agent("my-agent", "my-org")
    .to_agent("weather-service", "weather-co")
    .with_payload({
        "domain": "weather",
        "params": {"location": "Tokyo"}
    })
    .classified_as("pub")  # Public classification
    .build()
)

# Sign the message with our private key
signed_message = agent.sign(message)
```

### Spec Document Format

All specification documents should include:

1. **Overview** - What this component does
2. **Design Goals** - What we're optimizing for
3. **Specification** - Detailed technical spec
4. **Examples** - Message examples
5. **Security Considerations** - Security implications
6. **Appendices** - Reference material

---

## Testing Requirements

### Unit Tests

- All new code must have unit tests
- Aim for 80%+ code coverage
- Test edge cases and error conditions

```python
# Example unit test
def test_message_signing():
    agent = Agent.create("test-agent", "test-org")
    message = MessageBuilder(Operation.QUERY).build()
    
    signed = agent.sign(message)
    
    assert signed.sig is not None
    assert signed.sig.startswith("ed25519:")
    assert agent.verify(signed) == True
```

### Integration Tests

- Test interactions between components
- Use Docker for test infrastructure
- Test realistic scenarios

```python
# Example integration test
async def test_agent_handshake():
    agent_a = Agent.create("agent-a", "org-a")
    agent_b = Agent.create("agent-b", "org-b")
    
    # Connect via relay
    async with RelayConnection(TEST_RELAY_URL) as conn:
        session = await agent_a.connect(agent_b.did, conn)
        
        assert session.verified == True
        assert session.capabilities is not None
```

### Protocol Conformance Tests

For SDK implementations, run the conformance test suite:

```bash
# Run conformance tests against an SDK
python tests/conformance/run.py --sdk python
python tests/conformance/run.py --sdk javascript
```

### Test Coverage Requirements

| Component | Required Coverage |
|-----------|------------------|
| Core Protocol | 90%+ |
| Security Code | 95%+ |
| SDKs | 80%+ |
| Utilities | 70%+ |

---

## Community

### GitHub Discussions

For questions, ideas, and general discussion:
- [Discussions](https://github.com/moltspeak/moltspeak/discussions)

**Categories:**
- **Q&A** - Get help with MoltSpeak
- **Ideas** - Share feature ideas
- **Show and Tell** - Share what you've built
- **General** - General discussion

### Real-Time Chat

Join our Discord server for real-time chat:
- [Discord](https://discord.gg/moltspeak) *(placeholder)*

**Channels:**
- `#general` - General discussion
- `#help` - Get help
- `#development` - Development discussion
- `#announcements` - Official announcements

### Office Hours

Weekly community calls (schedule TBD):
- Open discussion about MoltSpeak development
- Q&A with maintainers
- Feature demos and previews

### Mailing List

For low-frequency announcements:
- [announce@moltspeak.dev](mailto:announce@moltspeak.dev) *(placeholder)*

---

## Recognition

We value all contributions! Contributors are recognized in:

- **CONTRIBUTORS.md** - All contributors listed
- **Release Notes** - Contributions mentioned in releases
- **GitHub Profile** - Your contribution graph lights up!

### Becoming a Maintainer

Active contributors may be invited to become maintainers. Maintainers:
- Review and merge PRs
- Triage issues
- Help guide project direction
- Have write access to the repository

---

## License

By contributing to MoltSpeak, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](LICENSE)).

---

## Questions?

- **Documentation unclear?** - Open an issue or discussion
- **Stuck on something?** - Ask in Discord or Discussions
- **Found something broken?** - Report a bug

Thank you for contributing to MoltSpeak! 🦞

---

*Last Updated: 2025-01*
