# Vercel Deployment - Quick Reference

## Status: Ready to Deploy ✅

Your local environment is configured with:
- WalletConnect Project ID: `9dcab9917a341fc0934735119384bab8`
- Dev server running on http://localhost:3000
- All code committed to GitHub

---

## Vercel Configuration

### 1. Project Settings

**Root Directory**: `apps/web-dapp`

**Build Command**:
```
cd ../.. && pnpm install && pnpm -C apps/web-dapp build
```

**Install Command**:
```
pnpm install
```

**Output Directory**: `.next` (default)

---

### 2. Environment Variables (Copy-Paste Ready)

Add these in Vercel Dashboard → Environment Variables section:

```
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.arc-testnet.circle.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=9dcab9917a341fc0934735119384bab8
NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_NOVELTY_DETECTOR_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_ORCHESTRATOR_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_USDC_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_API_GATEWAY_URL=https://api.kineticledger.com
NEXT_PUBLIC_APP_NAME=Kinetic Ledger
NEXT_PUBLIC_APP_DESCRIPTION=AI-powered motion attestation on Arc blockchain
NEXT_PUBLIC_VERBOSE=false
```

**Or add individually:**

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_CHAIN_ID` | `421614` |
| `NEXT_PUBLIC_ARC_RPC_URL` | `https://rpc.arc-testnet.circle.com` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `9dcab9917a341fc0934735119384bab8` |
| `NEXT_PUBLIC_ATTESTED_MOTION_ADDRESS` | `0x0000000000000000000000000000000000000000` |
| `NEXT_PUBLIC_NOVELTY_DETECTOR_ADDRESS` | `0x0000000000000000000000000000000000000000` |
| `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` | `0x0000000000000000000000000000000000000000` |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x0000000000000000000000000000000000000000` |
| `NEXT_PUBLIC_API_GATEWAY_URL` | `https://api.kineticledger.com` |
| `NEXT_PUBLIC_APP_NAME` | `Kinetic Ledger` |
| `NEXT_PUBLIC_APP_DESCRIPTION` | `AI-powered motion attestation on Arc blockchain` |
| `NEXT_PUBLIC_VERBOSE` | `false` |

---

## Deployment URL

After deployment, your app will be at:
`https://kinetic-ledger-[your-team].vercel.app/studio`

---

## Post-Deployment Checklist

- [ ] Visit deployment URL
- [ ] Check browser console for errors (F12)
- [ ] Test "Connect Wallet" button
- [ ] Verify all 6 components render
- [ ] Update README.md with live URL
- [ ] Proceed to demo video recording

---

**Need help?** See VERCEL_DEPLOY.md for detailed step-by-step guide.
