# Bhai Bhai Aluminium Industries — Production Ready

## Render settings
- Root Directory: blank
- Build Command: `npm install`
- Start Command: `npm start`

## Required security environment variables
- `SESSION_SECRET` = long random secret
- `ADMIN_USER` = initial admin ID
- `ADMIN_PASSWORD` = initial admin password (used only when no stored credential exists)

Do not set `ADMIN_PASSWORD_HASH` if you want the initial password to come from `ADMIN_PASSWORD`.

## Email OTP recovery / credential changes
The admin credential change and forgot-password flow uses **two separate OTPs** sent to the owner's email.

Required Render variables:
- `OWNER_EMAIL` = owner's recovery email
- `SMTP_HOST` = e.g. `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_SECURE` = `false`
- `SMTP_USER` = SMTP account email
- `SMTP_PASS` = SMTP app password
- `SMTP_FROM` = sender email (usually same as SMTP_USER)

For Gmail, use a Google App Password rather than the normal Gmail password.

## Important hosting note
The app currently stores website data and uploaded images in `data/store.json` and `public/uploads`. Render's free service filesystem is not persistent across every redeploy/restart. For permanent production data, use a persistent disk/database/object storage (or deploy on a persistent Hostinger setup).


V7 fixes Render reverse-proxy session authentication, uses atomic JSON writes, and adds three subtle glass diagonal lines limited to the upper half of the visual background.
