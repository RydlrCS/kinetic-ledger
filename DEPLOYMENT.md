# Deployment Guide - Kinetic Ledger

This guide covers deploying the Kinetic Ledger platform to production on Vercel (frontend) and Arc testnet (smart contracts).

---

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub account connected to Vercel
- WalletConnect Project ID (free): https://cloud.walletconnect.com
- Arc testnet RPC access (public endpoint available)

### Step 1: Fork or Clone Repository
```bash
git clone https://github.com/RydlrCS/kinetic-ledger.git
cd kinetic-ledger
```

### Step 2: Install Dependencies
```bash
pnpm install
```

### Step 3: Configure Environment Variables
Create `apps/web-dapp/.env.local` from the example:
```bash
cp apps/web-dapp/.env.example apps/web-dapp/.env.local
```

Edit the file with your values:
```env
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc-testnet.gelato.digital
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_project_id
```

### Step 4: Test Local Build
```bash
pnpm -C apps/web-dapp build
pnpm -C apps/web-dapp start
```

Visit http://localhost:3000 to verify the production build works.

### Step 5: Deploy to Vercel

#### Option A: Vercel CLI (Recommended)
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

#### Option B: Vercel Dashboard
1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web-dapp`
   - **Build Command**: `pnpm -C apps/web-dapp build`
   - **Output Directory**: `apps/web-dapp/.next`
   - **Install Command**: `pnpm install`
4. Add environment variables from `.env.example`
5. Click "Deploy"

### Step 6: Configure Custom Domain (Optional)
1. Go to Project Settings > Domains
2. Add your custom domain (e.g., `kinetic-ledger.com`)
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` environment variable

---

## 📦 Smart Contract Deployment (Arc Testnet)

### Prerequisites
- Arc testnet USDC (get from faucet: https://faucet.circle.com/)
- Private key with deployer privileges
- Hardhat configured for Arc network

### Step 1: Configure Hardhat for Arc
Edit `packages/contracts/hardhat.config.ts`:
```typescript
const config: HardhatUserConfig = {
  networks: {
    arcTestnet: {
      url: process.env.ARC_RPC_URL || 'https://rpc.arc-testnet.gelato.digital',
      chainId: 42069,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      gasPrice: 'auto',
    },
  },
};
```

### Step 2: Set Environment Variables
Create `packages/contracts/.env`:
```env
ARC_RPC_URL=https://rpc.arc-testnet.gelato.digital
DEPLOYER_PRIVATE_KEY=your_private_key_here
USDC_TOKEN_ADDRESS=0x... # Arc testnet USDC address
```

⚠️ **NEVER commit private keys to git!**

### Step 3: Compile Contracts
```bash
pnpm -C packages/contracts build
```

### Step 4: Run Tests
```bash
pnpm -C packages/contracts test
```

Ensure all 11 tests pass before deploying.

### Step 5: Deploy to Arc Testnet
```bash
pnpm -C packages/contracts deploy:arc
```

Expected output:
```
Deploying to Arc testnet (chainId: 42069)...
✅ MotionCredentialNFT deployed to: 0xABC...123
✅ MotionCredentialERC1155 deployed to: 0xDEF...456
✅ MotionBlendNFT deployed to: 0xGHI...789
✅ RkCNNMotionValidator deployed to: 0xJKL...012
```

### Step 6: Verify Contracts (Optional)
```bash
npx hardhat verify --network arcTestnet 0xABC...123
```

### Step 7: Update Frontend Environment
Copy deployed contract addresses to `apps/web-dapp/.env.local`:
```env
NEXT_PUBLIC_MOTION_CREDENTIAL_NFT_ADDRESS=0xABC...123
NEXT_PUBLIC_MOTION_CREDENTIAL_ERC1155_ADDRESS=0xDEF...456
NEXT_PUBLIC_MOTION_BLEND_NFT_ADDRESS=0xGHI...789
NEXT_PUBLIC_RKCNN_VALIDATOR_ADDRESS=0xJKL...012
```

Redeploy frontend:
```bash
vercel --prod
```

---

## 🔧 Backend Services Deployment

### API Gateway (FastAPI)

#### Deploy to Fly.io
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Navigate to API gateway
cd apps/api-gateway

# Initialize Fly app
fly launch --name kinetic-ledger-api --region iad

# Set environment variables
fly secrets set AGENT_WEBHOOK_SECRET=your_secret_here
fly secrets set ARC_RPC_URL=https://rpc.arc-testnet.gelato.digital

# Deploy
fly deploy
```

#### Deploy to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init

# Add environment variables
railway variables set AGENT_WEBHOOK_SECRET=your_secret
railway variables set ARC_RPC_URL=https://rpc.arc-testnet.gelato.digital

# Deploy
railway up
```

### Agent Service (TypeScript)

#### Deploy to Render
1. Go to https://render.com/new
2. Select "Background Worker"
3. Connect GitHub repository
4. Configure:
   - **Build Command**: `pnpm install && pnpm -C apps/agent-service build`
   - **Start Command**: `pnpm -C apps/agent-service start`
5. Add environment variables:
   - `WALLET_PRIVATE_KEY` (validator key)
   - `ARC_RPC_URL`
   - `AGENT_WEBHOOK_SECRET`
6. Click "Create Background Worker"

---

## 🔐 Security Checklist

### Before Production Deployment
- [ ] All private keys stored in secure vault (never in code)
- [ ] Environment variables set on hosting platform (not in `.env` files committed to git)
- [ ] Contract ownership transferred to multisig wallet
- [ ] Rate limiting enabled on API gateway
- [ ] CORS configured with whitelist of allowed origins
- [ ] HTTPS enforced on all domains
- [ ] Security headers configured (X-Frame-Options, CSP, etc.)
- [ ] Contract pauser role assigned to emergency contact
- [ ] Monitoring and alerting configured (Sentry, LogDNA, etc.)
- [ ] Backup validator keys stored offline

### Post-Deployment Verification
- [ ] Test wallet connection on live site
- [ ] Verify contract interactions work end-to-end
- [ ] Check transaction confirmations on Arc explorer
- [ ] Test USDC payment flows
- [ ] Verify motion attestation creation
- [ ] Test NFT minting (ERC-721 and ERC-1155)
- [ ] Check API gateway health endpoint
- [ ] Monitor agent service logs for errors
- [ ] Verify all external links work (docs, explorer, etc.)

---

## 📊 Monitoring & Observability

### Frontend (Vercel)
- **Analytics**: Built-in Vercel Analytics
- **Logs**: Vercel Logs dashboard
- **Errors**: Integrate Sentry for error tracking

### Smart Contracts (Arc)
- **Explorer**: https://explorer.arc-testnet.gelato.digital
- **RPC Health**: Monitor uptime and response times
- **Gas Usage**: Track transaction costs in USDC

### Backend Services
- **API Gateway**: Health endpoint at `/health`
- **Agent Service**: Structured logs with `VERBOSE=true`
- **Alerts**: Set up PagerDuty or similar for critical failures

### Recommended Monitoring Tools
- **Uptime**: UptimeRobot (free tier)
- **Errors**: Sentry (free tier)
- **Logs**: LogDNA or Papertrail
- **Performance**: Vercel Analytics
- **Blockchain**: Tenderly for contract monitoring

---

## 🚨 Rollback Procedure

### Frontend Rollback
```bash
# Via Vercel CLI
vercel rollback

# Or via Vercel Dashboard
# Go to Deployments > Select previous working deployment > "Promote to Production"
```

### Contract Rollback
⚠️ **Smart contracts are immutable!** Use these alternatives:
1. **Pause contracts**: Call `pause()` function if implemented
2. **Update frontend**: Point to previous contract addresses
3. **Transfer ownership**: If critical bug, deploy new contracts and migrate state

### Backend Rollback
```bash
# Fly.io
fly releases rollback

# Railway
railway rollback

# Render
# Use dashboard to deploy previous version
```

---

## 📝 Environment Variables Reference

### Web Dapp (Next.js)
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NEXT_PUBLIC_ARC_RPC_URL` | ✅ | Arc blockchain RPC endpoint | `https://rpc.arc-testnet.gelato.digital` |
| `NEXT_PUBLIC_CHAIN_ID` | ✅ | Arc chain ID | `42069` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ | WalletConnect cloud project ID | `abc123def456` |
| `NEXT_PUBLIC_MOTION_CREDENTIAL_NFT_ADDRESS` | ✅ | ERC-721 contract address | `0xABC...123` |
| `NEXT_PUBLIC_USDC_TOKEN_ADDRESS` | ✅ | USDC token address on Arc | `0xDEF...456` |
| `NEXT_PUBLIC_APP_URL` | ⚪ | Production URL | `https://kinetic-ledger.vercel.app` |

### API Gateway (FastAPI)
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `AGENT_WEBHOOK_SECRET` | ✅ | HMAC secret for webhook auth | `random_secure_string` |
| `ARC_RPC_URL` | ✅ | Arc RPC endpoint | `https://rpc.arc-testnet.gelato.digital` |
| `CORS_ORIGINS` | ⚪ | Allowed CORS origins | `https://kinetic-ledger.vercel.app` |
| `RATE_LIMIT_PER_MINUTE` | ⚪ | API rate limit | `60` |

### Agent Service (TypeScript)
| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WALLET_PRIVATE_KEY` | ✅ | Validator private key | `0x123...abc` |
| `ARC_RPC_URL` | ✅ | Arc RPC endpoint | `https://rpc.arc-testnet.gelato.digital` |
| `AGENT_WEBHOOK_SECRET` | ✅ | Shared secret with API gateway | `same_as_api_gateway` |
| `VERBOSE` | ⚪ | Enable trace-level logging | `true` |

---

## 🎯 Production URLs

After deployment, update these in your hackathon submission:

- **Live Demo**: https://kinetic-ledger.vercel.app
- **Motion Studio**: https://kinetic-ledger.vercel.app/studio
- **API Gateway**: https://kinetic-ledger-api.fly.dev
- **GitHub**: https://github.com/RydlrCS/kinetic-ledger
- **Arc Explorer**: https://explorer.arc-testnet.gelato.digital

---

## 📞 Support

- **Vercel Deployment**: https://vercel.com/docs
- **Arc Blockchain**: https://docs.circle.com/arc
- **Hardhat**: https://hardhat.org/hardhat-runner/docs/getting-started
- **Next.js**: https://nextjs.org/docs

---

**Last Updated**: October 31, 2025  
**Deployment Status**: Ready for production ✅
