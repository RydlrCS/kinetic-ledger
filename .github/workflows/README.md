# CI/CD Workflows - GitHub Actions

Automated testing, building, and deployment pipelines for Kinetic Ledger.

## Workflows Overview

### 1. Smart Contracts CI (`contracts.yml`)
**Triggers**: Push/PR to `packages/contracts/**`

**Jobs**:
- ✅ **Compile & Test**: Hardhat compilation + test suite execution
- ✅ **Lint**: Solhint static analysis
- ✅ **Gas Report**: Gas usage analysis on PRs
- ✅ **Artifacts**: Upload compiled contracts + typechain types

**Required Secrets**: None (public repo)

**Artifacts**:
- `contract-artifacts/` - Compiled contracts and typechain-types (7 days retention)

### 2. API Gateway CI (`api-gateway.yml`)
**Triggers**: Push/PR to `apps/api-gateway/**`

**Jobs**:
- ✅ **Lint & Test**: Ruff linting, formatting, type checking (mypy)
- ✅ **Security Scan**: Safety (dependency vulnerabilities) + Bandit (code security)
- ✅ **Coverage**: pytest with coverage reports → Codecov

**Required Secrets**: 
- `CODECOV_TOKEN` (optional - for coverage upload)

**Python Version**: 3.11

### 3. Agent Service CI (`agent-service.yml`)
**Triggers**: Push/PR to `apps/agent-service/**`

**Jobs**:
- ✅ **Build & Lint**: TypeScript compilation + ESLint
- ✅ **Test**: Jest/Mocha test suite (when implemented)

**Required Secrets**: None

**Artifacts**:
- `agent-service-dist/` - Compiled JavaScript (7 days retention)

### 4. Web Dapp CI (`web-dapp.yml`)
**Triggers**: Push/PR to `apps/web-dapp/**`

**Jobs**:
- ✅ **Build & Lint**: Next.js build + ESLint + TypeScript type checking
- ✅ **Lighthouse**: Performance audit on PRs (when configured)

**Required Secrets**: None (uses placeholder env vars)

**Artifacts**:
- `web-dapp-build/` - Next.js build output (7 days retention)

### 5. Deploy to Arc (`deploy.yml`)
**Triggers**: Manual workflow dispatch only

**Jobs**:
- 🚀 **Deploy Contracts**: Deploy to Arc testnet/mainnet
- 📝 **Update Env Files**: Save deployment addresses

**Required Secrets**:
- `ARC_RPC_URL` - Arc testnet/mainnet RPC endpoint
- `DEPLOYER_PRIVATE_KEY` - Deployer wallet private key (⚠️ HIGH SECURITY)

**Artifacts**:
- `deployment-addresses/` - Deployment JSON files (90 days retention)

## Secret Management

### Required GitHub Secrets

Configure in: **Settings → Secrets and variables → Actions**

#### Deployment Secrets (High Security)
```
ARC_RPC_URL=https://rpc.arc-testnet.circle.com
DEPLOYER_PRIVATE_KEY=0x...  # ⚠️ NEVER commit this!
```

#### Optional Secrets
```
CODECOV_TOKEN=...           # For coverage reports
WALLETCONNECT_PROJECT_ID=...  # For web dapp
```

### Secret Rotation Policy
- ✅ Rotate `DEPLOYER_PRIVATE_KEY` after each mainnet deployment
- ✅ Use separate keys for testnet vs mainnet
- ✅ Limit key permissions (deployer ≠ treasurer ≠ admin)
- ✅ Monitor wallet activity for unauthorized transactions

## Environment-Specific Configurations

### Testnet
- **Environment**: `testnet`
- **Network**: Arc Testnet (Chain ID: 421614)
- **Gas Token**: Testnet USDC from https://faucet.circle.com/
- **Auto-deploy**: On manual trigger only

### Mainnet (Future)
- **Environment**: `mainnet`
- **Network**: Arc Mainnet
- **Gas Token**: Real USDC
- **Approvals**: Requires manual approval step + multi-sig

## Workflow Status Badges

Add to main `README.md`:

```markdown
[![Contracts CI](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/contracts.yml/badge.svg)](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/contracts.yml)
[![API Gateway CI](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/api-gateway.yml/badge.svg)](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/api-gateway.yml)
[![Agent Service CI](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/agent-service.yml/badge.svg)](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/agent-service.yml)
[![Web Dapp CI](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/web-dapp.yml/badge.svg)](https://github.com/RydlrCS/kinetic-ledger/actions/workflows/web-dapp.yml)
```

## Usage

### Running Workflows Manually

#### Deploy to Arc Testnet
```
1. Go to: Actions → Deploy to Arc Testnet
2. Click "Run workflow"
3. Select environment: testnet
4. Click "Run workflow" button
5. Monitor deployment logs
6. Download deployment-addresses artifact
7. Update .env files with new addresses
```

### Local Development

#### Test contracts locally (same as CI)
```bash
cd packages/contracts
npm ci
npm run build
npm test
npm run lint
```

#### Test API gateway locally
```bash
cd apps/api-gateway
pip install -r requirements.txt
pip install ruff pytest
ruff check .
pytest --cov=.
```

#### Test agent service locally
```bash
cd apps/agent-service
npm ci
npm run build
npm run lint
npm test
```

#### Test web dapp locally
```bash
cd apps/web-dapp
npm ci
npm run type-check
npm run lint
npm run build
```

## Troubleshooting

### "Missing required secrets"
**Solution**: Add secrets in GitHub Settings → Secrets and variables → Actions

### "Compilation failed"
**Solution**: Ensure Node.js v20 is used. Check local build with `npm run build`

### "Tests failed"
**Solution**: Run tests locally first. Check error logs in Actions tab

### "Deployment failed: insufficient USDC"
**Solution**: Fund deployer wallet with testnet USDC from https://faucet.circle.com/

### "Artifact upload failed"
**Solution**: Check artifact size (<2GB). Ensure retention days ≤ 90

## Future Enhancements

### Planned Improvements
- [ ] Add Slither static analysis for contracts
- [ ] Implement automated security audits (MythX, Echidna)
- [ ] Add end-to-end tests with Playwright
- [ ] Deploy to staging environment before production
- [ ] Automated contract verification on Arc explorer
- [ ] Slack/Discord notifications for deployment status
- [ ] Automated dependency updates (Dependabot)
- [ ] Performance regression testing

### Integration Opportunities
- **Codecov**: Code coverage tracking and PR comments
- **Lighthouse CI**: Automated performance audits
- **Snyk**: Security vulnerability scanning
- **SonarCloud**: Code quality metrics
- **Vercel**: Automated web dapp preview deployments

## Security Best Practices

### ✅ DO
- Use GitHub Environments for production deployments
- Require manual approval for mainnet deployments
- Rotate secrets regularly
- Use separate keys for different environments
- Audit workflow changes before merging
- Enable branch protection rules
- Use dependabot for dependency updates

### ❌ DON'T
- Commit private keys in code or logs
- Use production keys in CI/CD
- Skip security scans
- Deploy without testing first
- Allow auto-merge on deployment workflows
- Share secrets across environments
- Disable required status checks

## Related Documentation

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Arc Deployment Guide](../packages/contracts/DEPLOYMENT.md)
- [Security Policy](../SECURITY.md) (when created)

## License

MIT - See [LICENSE](../LICENSE)
