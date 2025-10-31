# Known Issues

## Node.js Version Compatibility

**Issue**: Hardhat 2.22.10 requires Node.js ≥18, but current environment is running Node v17.8.0.

**Symptoms**:
- `npx hardhat compile` hangs after displaying telemetry prompt
- Engine warnings during `npm install` for `@nomicfoundation/edr` and `@ethereumjs/*` packages
- pnpm 9.12.0 cannot be installed (requires Node ≥18.12)

**Impact**: 
- Cannot compile contracts with current Node version
- Cannot run tests until compilation succeeds
- pnpm workspace features unavailable

**Workarounds**:

### Option 1: Upgrade Node.js via Homebrew (Recommended)
```bash
# Install latest LTS version
brew install node@20

# Add to PATH (add to ~/.zshrc for persistence)
export PATH="/usr/local/opt/node@20/bin:$PATH"

# Verify
node --version  # Should show v20.x.x
```

### Option 2: Install nvm (Node Version Manager)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source profile
source ~/.zshrc

# Install Node 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verify
node --version  # Should show v20.x.x
```

### Option 3: Use Docker (Isolated Environment)
```bash
# Run compilation in Docker container
docker run --rm -v "$(pwd)":/app -w /app/packages/contracts node:20-alpine sh -c "npm install && npx hardhat compile"

# Run tests
docker run --rm -v "$(pwd)":/app -w /app/packages/contracts node:20-alpine sh -c "npx hardhat test"
```

**Next Steps After Node Upgrade**:
```bash
# Clear existing node_modules
rm -rf packages/contracts/node_modules

# Reinstall with correct Node version
cd packages/contracts
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Install pnpm globally
npm install -g pnpm@9.12.0

# Return to root and use pnpm for monorepo
cd ../..
pnpm install
```

## Contract Compilation Status

**AttestedMotion.sol** (173 lines):
- ✅ Solidity syntax valid (manually verified)
- ❌ Not yet compiled to bytecode (blocked by Node version)
- ❌ Tests not yet run

**RewardsEscrow.sol** (67 lines):
- ✅ Solidity syntax valid (manually verified)  
- ❌ Not yet compiled to bytecode (blocked by Node version)
- ❌ Tests not yet run

## Hackathon Timeline Considerations

**Submission Deadline**: November 9, 2025 at 2:30 AM EAT

**Critical Path**:
1. ✅ Monorepo structure created
2. ✅ Smart contracts written  
3. ✅ Comprehensive tests written
4. ⚠️ **BLOCKED**: Contracts not compiled (Node version issue)
5. ❌ Contracts not deployed to Arc testnet
6. ❌ API gateway not implemented
7. ❌ Agent service not implemented
8. ❌ Web dapp not implemented
9. ❌ Demo/presentation materials not created

**Recommendation**: Prioritize Node.js upgrade to unblock contract compilation/testing, then proceed with rapid prototyping of remaining components.
