# Railway Deployment Guide - Kinetic Ledger

## Motion Blend Service - Fast Deployment Steps

### Step 1: Prepare Repository
Your repo is already ready! The service includes:
- ✅ `requirements.txt` - All Python dependencies
- ✅ `Procfile` - Railway process configuration
- ✅ `main.py` - FastAPI entry point (in apps/motion-blend-service/)

### Step 2: Deploy to Railway

1. **Go to Railway Dashboard**: https://railway.app/dashboard

2. **Create New Project**:
   - Click "Create New Project"
   - Select "Deploy from GitHub"
   - Connect your GitHub account if not already done
   - Select `RydlrCS/kinetic-ledger` repo

3. **Configure Service**:
   - Railway will auto-detect Python
   - Set the following environment variables:
     ```
     ROOT_DIR=apps/motion-blend-service
     ARC_RPC_URL=https://rpc.arc-testnet.gelato.digital
     USDC_ADDRESS=0xEB466342C4d449BC9f53A865D5Cb90586f405215a
     VALIDATOR_PRIVATE_KEY=<your-testnet-key>
     VERBOSE=false
     LOG_LEVEL=info
     ```

4. **Deploy**:
   - Railway will install dependencies from `requirements.txt`
   - Start process defined in `Procfile`
   - Get public URL like: `https://kinetic-motion-blend-xxxx.railway.app`

### Step 3: Verify Deployment

```bash
# Test health endpoint
curl https://your-railway-app.railway.app/health

# View Swagger docs
https://your-railway-app.railway.app/docs
```

### Step 4: Update Web Dapp

Update `apps/web-dapp/.env.local`:
```
NEXT_PUBLIC_MOTION_BLEND_SERVICE_URL=https://your-railway-app.railway.app
```

## Troubleshooting

### Port Issue
- Railway automatically assigns a PORT env var
- Our `main.py` reads: `PORT = int(os.getenv("PORT", 8000))`
- ✅ Already handles dynamic port assignment

### Python Version
- Railway uses Python 3.11 by default
- Our code requires Python 3.10+
- ✅ Compatible

### Dependencies
- All deps in `requirements.txt` are pip-installable
- torch will take ~2 mins to install (largest package)
- ✅ No custom build needed

## Quick Reference - Key Files

```
kinetic-ledger/
├── Procfile                                    # Railway process config
├── apps/
│   └── motion-blend-service/
│       ├── main.py                             # Entry point
│       ├── requirements.txt                    # Dependencies  
│       └── src/
│           ├── api.py                          # FastAPI app
│           ├── blend_engine.py                 # Motion blending logic
│           ├── quality_metrics.py              # Quality scoring
│           └── bvh_utils.py                    # BVH file parsing
```

## Expected Startup Time

- **Build**: 3-5 minutes (pip installs torch, numpy, etc)
- **Startup**: 30-60 seconds (app initialization)
- **Total**: 4-6 minutes until service is live

## Support

For Railway support: https://railway.app/support
For Kinetic Ledger issues: Check DEPLOYMENT.md in root
