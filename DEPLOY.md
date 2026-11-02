# Deploying Sitewise to the web

Sitewise is a **single Java service**: `backend/Main.java` serves the
`frontend/` and `websitecdnshaders/` files *and* the `/api/...` endpoints from
the same origin. Supabase (auth + database) and Groq (AI) are external
services. The included `Dockerfile` packages everything into one container.

**Recommended host: Render** (free tier, Docker support, automatic HTTPS).

> Vercel cannot run this app as-is. Vercel runs static files and short-lived
> serverless functions, not a long-running `com.sun.net.httpserver` process.
> The linked `.vercel/` folder does not make the Java backend deploy there.

---

## What was changed to make it deployable

- Fixed the compile error in `Main.java` (`BuyingoHandler` → `BuyingChatHandler`).
- Moved the Groq API key out of source code into the `GROQ_API_KEY` env var.
- Dockerfile now copies `backend/prompts/` (required at runtime) and uses a
  multi-stage build (JDK to compile, JRE to run).
- Added a thread pool so one slow AI request cannot block the whole site.
- Added `/healthz` for the host's health checks.
- Added `render.yaml` and `.dockerignore`.
- Prompt loading now works when starting from the repo root or `backend/`.

---

## 1. Rotate the Groq key first

The old key was hardcoded in `backend/GroqClient.java`, so treat it as
public. Before deploying:

1. Open <https://console.groq.com/keys>.
2. Delete the old key.
3. Create a new key and keep it somewhere safe. You will paste it into Render.

Never commit the new key. `GROQ_API_KEY` must only exist in your local shell or
the host's environment settings.

---

## 2. Test the production layout locally (optional)

You need Java 21+ (Java 26 is installed on this machine).

```powershell
cd C:\Users\HP\Downloads\javaconstruct
javac -d out backend\*.java
$env:GROQ_API_KEY = "your-new-key"
java -cp out Main 8080
```

Open <http://localhost:8080> and <http://localhost:8080/healthz>.

If you install Docker Desktop, you can test the exact container:

```powershell
docker build -t sitewise .
docker run --rm -p 8080:8080 -e GROQ_API_KEY="your-new-key" sitewise
```

---

## 3. Push the project to GitHub

The folder is not a git repository yet.

```powershell
cd C:\Users\HP\Downloads\javaconstruct
git init
git add .
git commit -m "Prepare Sitewise for deployment"
git branch -M main
```

Create an empty repository on GitHub (no README, no .gitignore), then:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/sitewise.git
git push -u origin main
```

`.env.local`, `.vercel/`, `*.class`, and `out/` are ignored by `.gitignore`.
Double-check with `git status` that `.env.local` is **not** staged.

---

## 4. Deploy on Render

### Option A — Blueprint (uses `render.yaml`)

1. Sign up at <https://render.com> with GitHub.
2. Dashboard → **New +** → **Blueprint**.
3. Select the repository. Render reads `render.yaml`.
4. Enter `GROQ_API_KEY` when prompted.
5. Click **Apply** / **Deploy**.

### Option B — Manual web service

1. **New +** → **Web Service** → select the repository.
2. Language: **Docker**.
3. Branch: `main`; region: closest to your users.
4. Instance type: **Free**.
5. Health check path: `/healthz`.
6. Add environment variable `GROQ_API_KEY` = your new Groq key.
7. **Create Web Service**.

The first build takes roughly 3–5 minutes. Render gives you a URL like
`https://sitewise-xxxx.onrender.com`.

---

## 5. Point Supabase at the live URL

In the Supabase dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://your-app.onrender.com`
- **Redirect URLs:** add `https://your-app.onrender.com/**`
  (keep `http://localhost:8080/**` for local development)

Without this, email confirmation and password-reset links can send users back
to `localhost`.

---

## 6. Smoke test the live site

- `https://your-app.onrender.com/healthz` → `{"status":"ok"}`
- Home page loads with CSS and shader assets.
- Sign up and sign in.
- Run a risk assessment (this calls Groq).
- Open the Buying Assistant and send a message.
- Refresh after login; the session should persist.

---

## 7. Custom domain (optional)

Render service → **Settings** → **Custom Domains** → add your domain. Create the
shown CNAME at your registrar. Render provisions TLS automatically. Also add the
new domain to the Supabase redirect URLs.

---

## Updating the site

```powershell
git add .
git commit -m "Describe the change"
git push
```

Render redeploys automatically on every push to `main`.

---

## Free-tier caveats

- Render free services spin down after ~15 minutes of inactivity. The next
  visit has a 30–60 second cold start.
- 512 MB RAM and shared CPU. This app is fine because AI calls are network-bound.
- Need it always-on? Upgrade to Starter (~$7/month), or use Railway/Fly.io.

---

## Before you share the link

- `/api/assess` and `/api/buying-assistant/chat` are public and
  unauthenticated. Anyone can call them and consume your Groq quota. Add rate
  limiting or auth, and set a spending limit in the Groq console.
- Keep `GROQ_API_KEY` only in Render's environment variables.
- The Supabase **anon** key in `frontend/supabase-client.js` is public by
  design. Row Level Security in `database/schema.sql` and
  `database/schema-module2.sql` is what protects user data — make sure both
  scripts have been run in the Supabase SQL editor.
- Rotate any secret that has ever been pasted into a public repo or chat.

---

## Alternative hosts

- **Railway** — New Project → Deploy from GitHub → Dockerfile, add
  `GROQ_API_KEY`, generate a domain. About $5 of usage credit per month.
- **Fly.io** — install `flyctl`, run `fly launch`,
  `fly secrets set GROQ_API_KEY=...`, then `fly deploy`.
- **Vercel (split setup)** — static frontend on Vercel + Java backend on Render.
  You would change `API_BASE` in `frontend/api.js` and the `fetch` URL in
  `frontend/buying-assistant.js` to the Render hostname. CORS is already `*`,
  but this has more moving parts and is not recommended for the first deploy.
