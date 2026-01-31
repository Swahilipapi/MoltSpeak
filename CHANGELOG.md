# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.1] - 2026-01-31

### Added
- Timestamp validation (5-min max age) - prevents replay attacks
- Agent name validation (alphanumeric, max 256 chars)
- Input validation hardening
- 400+ tests across both SDKs
- Cross-SDK integration tests
- Live network tests (4-agent orchestration)
- Conversation flow tests
- Error handling tests
- Stress tests

### Fixed
- Python crypto import (BadSignature → BadSignatureError)
- Test expectations for security validation
- GitHub Actions workflow

### Security
- Replay attack prevention via timestamp validation
- DoS prevention via input size limits
- Agent name injection prevention
