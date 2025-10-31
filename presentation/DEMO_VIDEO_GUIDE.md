# Demo Video - Quick Reference Guide

**Total Duration**: 3-5 minutes  
**Target Audience**: Hackathon judges, Arc ecosystem developers, fitness/insurance industry  
**Goal**: Show complete motion attestation flow with Arc's USDC-native advantages

---

## 🎬 Recording Checklist

### Before Recording
- [ ] Close all unnecessary browser tabs and applications
- [ ] Set browser to incognito/private mode (clean UI)
- [ ] Set display resolution to 1920x1080 (standard HD)
- [ ] Disable desktop notifications (Do Not Disturb mode)
- [ ] Prepare Arc testnet wallet with USDC balance
- [ ] Open local dev server: `pnpm -C apps/web-dapp dev`
- [ ] Test wallet connection beforehand
- [ ] Prepare voiceover script (see `presentation/DEMO_SCRIPT.md`)
- [ ] Set up microphone and test audio levels
- [ ] Choose background music (low volume, non-distracting)

### Recording Tools
- **Screen Capture**: OBS Studio (free, cross-platform) or QuickTime (macOS)
- **Audio**: Built-in mic or USB microphone (Blue Yeti, Rode NT-USB)
- **Video Editing**: DaVinci Resolve (free), iMovie, or Premiere Pro
- **Music**: YouTube Audio Library, Epidemic Sound, or Artlist

---

## 📝 Scene-by-Scene Breakdown

### Scene 1: Hook (0:00-0:20)
**Visual**: Landing page with Kinetic Ledger logo
**Voiceover**: "The $9 billion fitness tracking industry has a trust problem. Insurance companies lose millions to fake exercise claims. Move-to-earn games are exploited by bots. How do you prove someone actually exercised?"

**Recording Tips**:
- Start with strong problem statement
- Show newspaper headlines or statistics (optional overlay)
- Keep energy high to grab attention

### Scene 2: Solution Overview (0:20-0:45)
**Visual**: Architecture diagram from README
**Voiceover**: "Kinetic Ledger creates tamper-proof motion credentials using multi-sensor validation, AI-powered fraud detection with our RkCNN algorithm, and blockchain attestation on Arc—where USDC is the native gas token."

**Recording Tips**:
- Highlight the 3 key differentiators
- Show motion data flow diagram
- Emphasize "USDC-native" advantage

### Scene 3: Wallet Connection (0:45-1:00)
**Visual**: Click "Connect Wallet" button → RainbowKit modal → Select MetaMask → Approve connection
**Voiceover**: "Let's see it in action. I'll connect my wallet to Arc testnet. Notice my USDC balance—this is what I'll use to pay for gas and mint motion NFTs."

**Actions**:
1. Click "Connect Wallet" in header
2. Select wallet (MetaMask or WalletConnect)
3. Approve connection
4. Show wallet panel with USDC balance (150.00 USDC)

### Scene 4: Motion Studio - Configuration (1:00-1:45)
**Visual**: Navigate to `/studio` → Blend Configuration Module
**Voiceover**: "The Motion Studio lets me create unique motion blend NFTs. I'll choose three dance styles: Capoeira, Breakdance, and Salsa. Watch as I adjust the duration and transition settings between each style."

**Actions**:
1. Navigate to http://localhost:3000/studio
2. Show motion library (8 dance motifs)
3. Drag Capoeira to timeline (5 seconds)
4. Drag Breakdance (6 seconds)
5. Drag Salsa (4 seconds)
6. Adjust transition handles (1 second cross-fade)
7. Click "Preview Blend"

**Recording Tips**:
- Move slowly so viewers can follow
- Highlight the visual design (circular motifs, gradient blues)
- Show the real-time timeline update

### Scene 5: Motion Preview (1:45-2:15)
**Visual**: Motion Preview Panel with playhead scrubber
**Voiceover**: "The preview panel shows my complete 15-second motion sequence. I can scrub through the timeline to see exactly where each style blends into the next. The transition indicators show the AI is interpolating smoothly between styles."

**Actions**:
1. Click play button
2. Show playhead moving across timeline
3. Pause at transition point
4. Highlight transition indicator (mesh pattern overlay)
5. Show current segment badge (circular icon)

**Recording Tips**:
- Let the animation play for 5-10 seconds
- Point out the Polkadot-inspired design elements
- Show smooth transitions between styles

### Scene 6: AI Validation (2:15-2:45)
**Visual**: Click "Proceed to Validation" → Validation & Attestation View
**Voiceover**: "Before minting, the AI validates my motion blend. It checks quality, ensures compliance, and generates a cryptographic attestation. This uses EIP-712 typed signatures—the gold standard for blockchain data integrity."

**Actions**:
1. Click "Proceed to Validation" button
2. Show loading spinner (2 seconds)
3. Display validation results:
   - AI Quality Check: ✅ Passed (green)
   - Compliance Verification: ✅ Passed (green)
   - Oracle Attestation: 🎖️ Badge (pulsing animation)
4. Expand EIP-712 signature details
5. Show attestation metadata (oracle name, timestamp, standard)

**Recording Tips**:
- Emphasize the multi-layer validation
- Highlight the pulsing attestation badge
- Mention "ERC-8001 multi-agent format"

### Scene 7: Token Minting (2:45-3:15)
**Visual**: Click "Proceed to Minting" → Token Minting Interface
**Voiceover**: "Now I'm ready to mint. I can choose between ERC-721 for a unique 1-of-1 NFT, or ERC-1155 for multi-edition. The fee is 7 USDC—that's 99% cheaper than minting on Ethereum mainnet, thanks to Arc's USDC-native architecture."

**Actions**:
1. Click "Proceed to Minting" button
2. Show token metadata preview
3. Toggle between ERC-721 and ERC-1155
4. For ERC-1155, set quantity to 10
5. Check "Include attestation in metadata"
6. Highlight USDC fee display (7.00 USDC)
7. Show "99% cheaper than Ethereum" badge
8. Click "Mint Motion Token"

**Recording Tips**:
- Emphasize cost savings (7 USDC vs 70+ USDC on Ethereum)
- Show the fee breakdown
- Highlight sub-second finality

### Scene 8: Confirmation & Success (3:15-3:30)
**Visual**: Confirmation modal → Minting progress → Success screen
**Voiceover**: "Transaction confirmed in under 2 seconds. My motion blend NFT is now minted on Arc with the cryptographic attestation embedded in the metadata."

**Actions**:
1. Confirm minting in modal
2. Show "Minting on Arc..." spinner (2 seconds)
3. Display success screen:
   - Green checkmark ✅
   - Floating particle animation
   - Token ID: #42
   - Transaction hash
4. Click "View on Arc Explorer"
5. Show transaction details on block explorer

**Recording Tips**:
- Time the confirmation sequence to feel fast
- Highlight the "Sub-second finality" message
- Show celebratory animation

### Scene 9: NFT Display & Metadata (3:30-3:50)
**Visual**: Arc explorer showing NFT metadata
**Voiceover**: "On the Arc explorer, we can see the full metadata including the motion file URI, attestation signature, and blend configuration. The raw motion data stays off-chain for privacy, but the hash ensures immutability."

**Actions**:
1. Show Arc explorer NFT detail page
2. Highlight metadata fields:
   - Name: "Capoeira-Breakdance-Salsa Blend"
   - Motion file URI (IPFS hash)
   - Attestation signature
   - Blend segments (3 styles)
3. Show transaction details (gas paid in USDC)

**Recording Tips**:
- Zoom in on key metadata fields
- Emphasize privacy-first approach (hashes only)
- Show USDC gas payment

### Scene 10: Closing & Call-to-Action (3:50-4:00)
**Visual**: Return to landing page or show Kenya deployment graphic
**Voiceover**: "Kinetic Ledger brings cryptographic trust to fitness data. We're already deploying in Kenya with IX Africa, protecting 4 million policyholders from fraud. Built on Arc, powered by USDC, secured by AI. The future of motion attestation is here."

**Recording Tips**:
- End with strong call-to-action
- Show GitHub repo URL: github.com/RydlrCS/kinetic-ledger
- Display Arc x USDC Hackathon logo
- Fade to black with background music

---

## 🎵 Music Suggestions

### Royalty-Free Sources
- **YouTube Audio Library**: https://studio.youtube.com/channel/UC.../music
- **Incompetech**: https://incompetech.com/music/royalty-free/
- **Free Music Archive**: https://freemusicarchive.org/

### Genre Recommendations
- **Upbeat Tech**: Electronic, synthwave, minimal techno (60-80 BPM)
- **Corporate Inspiring**: Acoustic guitar, piano, strings (moderate tempo)
- **Futuristic**: Ambient, cinematic, glitch hop (70-90 BPM)

### Volume Levels
- Music: -20dB to -25dB (background only)
- Voiceover: -6dB to -10dB (primary audio)
- Sound effects: -15dB (UI clicks, confirmations)

---

## 🎞️ Editing Checklist

### DaVinci Resolve (Free) Workflow
1. **Import Clips**:
   - Screen recording (1920x1080, 30fps)
   - Voiceover audio (48kHz, 16-bit)
   - Background music (MP3 or WAV)

2. **Edit Timeline**:
   - Cut out pauses, "ums", mistakes
   - Add smooth transitions between scenes (0.5s cross-dissolve)
   - Sync voiceover with visuals
   - Trim to 3-5 minutes total

3. **Add Text Overlays**:
   - Opening title: "Kinetic Ledger - Motion Attestation on Arc"
   - Scene labels: "Motion Preview", "AI Validation", "Token Minting"
   - Key stats: "99% Cheaper", "Sub-Second Finality", "4M+ Policyholders"
   - Closing credits: "Built for Arc x USDC Hackathon 2025"

4. **Color Grading** (Optional):
   - Boost blues and teals (match UI palette)
   - Increase saturation by 10-15%
   - Add slight vignette for focus

5. **Sound Design**:
   - Normalize voiceover to -10dB
   - Add background music at -22dB
   - Add UI sound effects (whoosh, pop, success chime)
   - Apply noise reduction to voiceover
   - Add fade-in/fade-out to music

6. **Export Settings**:
   - Format: MP4 (H.264)
   - Resolution: 1920x1080 (Full HD)
   - Frame Rate: 30fps
   - Bitrate: 10-15 Mbps (high quality)
   - Audio: AAC 192kbps stereo

---

## 📤 Upload to YouTube

### Video Settings
- **Title**: "Kinetic Ledger - Motion Attestation on Arc | Arc x USDC Hackathon 2025"
- **Description**:
  ```
  Kinetic Ledger brings cryptographic trust to fitness data using multi-sensor validation, AI-powered fraud detection, and blockchain attestation on Arc.
  
  🔗 Links:
  - GitHub: https://github.com/RydlrCS/kinetic-ledger
  - Live Demo: https://kinetic-ledger.vercel.app
  - Devpost: https://devpost.com/software/kinetic-ledger
  - Arc Blockchain: https://www.circle.com/en/arc
  
  🏆 Built for Arc x USDC Hackathon (Oct 27 - Nov 9, 2025)
  
  📚 Chapters:
  0:00 - Problem: $9B Fitness Fraud
  0:20 - Solution Overview
  0:45 - Wallet Connection
  1:00 - Motion Studio Configuration
  1:45 - Motion Preview
  2:15 - AI Validation
  2:45 - Token Minting
  3:15 - Confirmation & Success
  3:30 - NFT Metadata
  3:50 - Closing
  
  #Arc #USDC #Blockchain #AI #Hackathon #Web3 #NFT #Fitness
  ```

- **Visibility**: Unlisted (for hackathon judges)
- **Thumbnail**: Custom 1280x720px image (Kinetic logo + "Motion Attestation on Arc")
- **Playlist**: Create "Arc x USDC Hackathon 2025" playlist
- **Tags**: Arc, USDC, Circle, Blockchain, NFT, AI, Motion Capture, Fitness Tracking, Hackathon

### After Upload
1. Copy YouTube URL (e.g., `https://youtu.be/abc123`)
2. Add to README.md: `[Demo Video](https://youtu.be/abc123)`
3. Add to Devpost submission
4. Add to `presentation/PITCH_DECK.md`
5. Share on Twitter/LinkedIn with hashtags: #ArcBlockchain #USDCHackathon

---

## 🎯 Success Criteria

Your demo video should:
- ✅ Show complete user flow (connect → configure → validate → mint)
- ✅ Highlight Arc's USDC-native advantages (predictable fees, sub-second finality)
- ✅ Demonstrate professional UI/UX (Polkadot-inspired design)
- ✅ Explain technical innovation (RkCNN algorithm, EIP-712 attestation)
- ✅ Showcase real-world impact (Kenya deployment, 4M+ policyholders)
- ✅ Run smoothly without errors or lag
- ✅ Have clear, enthusiastic voiceover
- ✅ Include background music (low volume)
- ✅ Display GitHub repo and live demo URLs
- ✅ Be 3-5 minutes long (judges' attention span)

---

## 🚨 Common Mistakes to Avoid

- ❌ Speaking too fast (slow down, let visuals breathe)
- ❌ Showing loading spinners for too long (edit them out)
- ❌ Forgetting to mute desktop notifications
- ❌ Background music too loud (voiceover should dominate)
- ❌ Skipping the problem statement (judges need context)
- ❌ Not highlighting Arc-specific benefits (USDC gas, finality)
- ❌ Video longer than 5 minutes (judges will skip)
- ❌ Low audio quality (use a decent microphone)
- ❌ Shaky cursor movement (move deliberately)
- ❌ Not including call-to-action (GitHub, demo, Devpost)

---

## 📞 Need Help?

- **OBS Studio Tutorial**: https://obsproject.com/wiki/OBS-Studio-Quickstart
- **DaVinci Resolve Basics**: https://www.blackmagicdesign.com/products/davinciresolve/training
- **YouTube Upload Guide**: https://support.google.com/youtube/answer/57407

---

**Recording Time Estimate**: 2-3 hours (including retakes)  
**Editing Time Estimate**: 4-6 hours (with titles, music, sound design)  
**Total Time**: ~8 hours (spread across 2 days)

Good luck! 🎬
