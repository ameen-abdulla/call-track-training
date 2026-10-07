# Call Track Training — Quick Installation Guide

This guide is for installing **Call Track Training** on your Windows PC.

---

## 📋 What You Need Before Starting

Your team or administrator will give you two details:

1. **Public Hostname** (e.g., `training.yourcompany.com`)
2. **Cloudflare Tunnel Token** (a long text code)

---

## 🚀 How to Install (Takes 2 Minutes)

1. **Download the Installer:**
   Locate `CallTrackTraining-Setup-0.2.0.exe`.

2. **Run as Administrator:**
   Right-click `CallTrackTraining-Setup-0.2.0.exe` and select **"Run as administrator"**.

3. **Follow the Setup Wizard:**
   - **Step 1 (Cloudflare Tunnel Setup):**
     - Paste your **Public Hostname**
     - Paste your **Cloudflare Tunnel Token**
     - Click **Next**
   - **Step 2 (Administrator Account):**
     - Enter your Name
     - Enter your Email Address
     - Choose a strong password (minimum 8 characters, at least 1 uppercase letter, 1 number, and 1 special symbol like `!@#$%`)
     - Click **Next**
   - **Step 3 (Internal Port):**
     - Leave as default (`4000`) unless instructed otherwise.
     - Click **Next**
   - **Step 4 (Install):**
     - Click **Install** and wait for the files to set up.

4. **Done!**
   Click **Finish**.

---

## 🌐 Opening the Application

Open your web browser (Chrome, Edge, etc.) and visit your public hostname:
```
https://training.yourcompany.com
```

Log in using the administrator email and password you created during setup.

---

## 🔄 Daily Operation (Set & Forget)

- **Does Call Track stay running?**
  Yes! It runs in the background as an automatic Windows Service.
- **Can I close the window or log out?**
  Yes. Call Track continues running in the background.
- **What happens if my PC restarts?**
  Call Track starts automatically as soon as Windows turns on.
- **What if my internet disconnects?**
  Call Track continues working locally and automatically reconnects to Cloudflare as soon as your internet returns.

---

## 📂 If You Ever Need Support

If your administrator asks for system logs, open:
```
C:\ProgramData\CallTrackTraining\logs
```
Select the latest `.log` file and email or send it to your support contact.
