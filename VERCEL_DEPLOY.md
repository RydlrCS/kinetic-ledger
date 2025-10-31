# Vercel Dashboard Deployment - Step-by-Step

**Time Required**: 15-20 minutes  
**Current Date**: October 31, 2025

---

## 🚀 Quick Deployment Steps

### Step 1: Get WalletConnect Project ID (5 minutes)

1. Open browser: https://cloud.walletconnect.com
2. Click **"Sign Up"** or **"Sign In"** (free account)
3. Click **"Create New Project"**
4. Project details:
   - **Name**: Kinetic Ledger
   - **Type**: dApp
5. Click **"Create"**
6. Copy the **Project ID** (looks like: `abc123def456ghi789`)
7. Save it somewhere - you'll need it in Step 3

---

### Step 2: Open Vercel Dashboard

1. Go to: https://vercel.com/new
2. Sign in with GitHub (authorize if prompted)
3. You'll see "Import Git Repository" page

---

### Step 3: Import GitHub Repository

1. In the search box, find: **RydlrCS/kinetic-ledger**
2. Click **"Import"** button
3. Configure Project:

   **Framework Preset**: Next.js (should auto-detect)
   
   **Root Directory**: 
   - Click "Edit" → Enter: `apps/web-dapp`
   - Click "Continue"
   
   **Build and Output Settings**:
   - **Build Command**: `pnpm -C apps/web-dapp build`
   - **Output Directory**: `apps/web-dapp/.next`
   - **Install Command**: `pnpm install`

---

### Step 4: Add Environment Variables

Click **"Environment Variables"** section, add these one by one:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_ARC_RPC_URL` | `https://rpc.arc-testnet.gelato.digital` |
| `NEXT_PUBLIC_CHAIN_ID` | `42069` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `[YOUR_PROJECT_ID_FROM_STEP_1]` |
| `NEXT_PUBLIC_APP_NAME` | `Kinetic Ledger` |
| `NEXT_PUBLIC_APP_DESCRIPTION` | `Motion Attestation on Arc` |

**Important**: 
- Replace `[YOUR_PROJECT_ID_FROM_STEP_1]` with the actual ID from WalletConnect
- Make sure there are NO quotes around the values
- Click "Add" after each variable

---

### Step 5: Deploy

1. Click **"Deploy"** button (big blue button at bottom)
2. Vercel will start building (takes 3-5 minutes)
3. Watch the build logs (you'll see Next.js compiling)
4. Wait for **"Deployment successful"** message

---

### Step 6: Test Your Deployment

1. Click **"Visit"** or **"Go to Deployment"**
2. You'll get a URL like: `https://kinetic-ledger-abc123.vercel.app`
3. Test these pages:
   - Landing page: `/`
   - Motion Studio: `/studio`
4. Try connecting a wallet (should show RainbowKit modal)

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Landing page loads without errors
- [ ] Navigate to `/studio` - all UI components visible
- [ ] Click "Connect Wallet" - RainbowKit modal appears
- [ ] No console errors (press F12 → Console tab)
- [ ] Motion Studio shows:
  - [ ] Kinetic Logo animation
  - [ ] Motion Preview Panel with timeline
  - [ ] Blend Configuration with 8 dance motifs
  - [ ] Step indicator (Configure → Validate → Mint)

---

## 🔧 If Build Fails

### Common Issues & Fixes:

**Issue**: "Build failed - Cannot find module"
- **Fix**: Make sure Root Directory is set to `apps/web-dapp`

**Issue**: "Build failed - Missing environment variable"
- **Fix**: Check all 5 environment variables are added correctly

**Issue**: "Build timeout"
- **Fix**: Redeploy (click "Redeploy" button in deployment page)

**Issue**: "WalletConnect doesn't work"
- **Fix**: Double-check Project ID is correct (no extra spaces)

---

## 📝 After Successful Deployment

1. **Copy the live URL** (e.g., `https://kinetic-ledger-abc123.vercel.app`)

2. **Update README.md**:
   - Replace demo URL placeholder with your actual URL
   - Commit and push:
     ```bash
     git add README.md
     git commit -m "docs: add live demo URL"
     git push origin main
     ```

3. **Test on mobile**:
   - Open URL on your phone
   - Try connecting wallet with WalletConnect
   - Check if UI is responsive

4. **Share with team/friends**:
   - Get feedback on the UI
   - Test different browsers (Chrome, Safari, Firefox)

---

## 🎯 Next Steps After Deployment

1. ✅ **Update PROJECT_STATUS.md** with live URL
2. ✅ **Add URL to CRITICAL_PATH.md**
3. ✅ **Prepare for demo video recording** (Nov 2-3)
4. ✅ **Take screenshots** from live demo for Devpost

---

## 🆘 Need Help?

**Vercel Support**:
- Docs: https://vercel.com/docs
- Community: https://github.com/vercel/vercel/discussions

**WalletConnect Issues**:
- Docs: https://docs.walletconnect.com/
- Get new Project ID if needed

**GitHub Issues**:
- Open issue: https://github.com/RydlrCS/kinetic-ledger/issues

---

## 🎉 Deployment Complete!

Once deployed successfully, you'll have:
- ✅ Live demo URL for hackathon submission
- ✅ Automatic HTTPS (Vercel provides SSL)
- ✅ Global CDN (fast worldwide access)
- ✅ Preview deployments for every commit
- ✅ Analytics dashboard (Vercel Analytics)

**Estimated total time**: 15-20 minutes

---

**Last Updated**: October 31, 2025  
**Status**: Ready to deploy 🚀
