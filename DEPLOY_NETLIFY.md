# Deploying PulseQR to Netlify & Firebase

## 1. Enable Firebase Services
1. Open the [Firebase Console](https://console.firebase.google.com/) and select your project.
2. **Authentication**: Go to **Build → Authentication → Sign-in method**:
   - Enable **Google** (pre-enabled in AI Studio).
   - Enable **Email/Password** so users can sign up, sign in, verify emails, and reset passwords.
   - Add your Netlify custom domain (e.g., `your-site.netlify.app` or `yourdomain.com`) under **Settings → Authorized domains**.
3. **Firestore Database**: Already provisioned and secured with `firestore.rules`. To deploy rules manually later:
   ```bash
   npx firebase deploy --only firestore:rules
   ```
4. **Firebase Storage (Optional for Media QR Uploads)**: Go to **Build → Storage** and click **Get Started** to store custom logos, avatars, and uploaded PDF/image/video QR assets.

## 2. Deploy to Netlify
1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Log in to [Netlify](https://app.netlify.com/) and choose **Add new site → Import an existing project**.
3. Netlify automatically detects `netlify.toml`:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Click **Deploy site**.

## 3. Custom Domain & Dynamic QR Redirects
- Every dynamic QR code encodes `https://yourdomain.com/redirect?id=QR_ID` (and supports short URLs at `https://yourdomain.com/r/QR_ID`).
- `netlify.toml` and `public/_redirects` route all requests cleanly to the SPA so `/redirect?id=QR_ID` resolves instantly, records the scan atomically in Firestore, and redirects visitors to the latest `currentLink`.
