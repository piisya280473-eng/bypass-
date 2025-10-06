import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

const PORT = Number(process.env.PORT || 3000);
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const NAV_TIMEOUT = Number(process.env.NAVIGATE_TIMEOUT_MS || 60000);
const WAIT_TOKEN_MS = Number(process.env.WAIT_TOKEN_MS || 120000);

const app = express();

app.get("/api/bypass", async (req, res) => {
  const { url, proxy } = req.query;
  const timeoutMs = WAIT_TOKEN_MS;
  const headless = HEADLESS;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'url' parameter" });
  }

  let browser;
  try {
    const args = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,800",
    ];

    if (proxy && typeof proxy === "string") {
      args.push(`--proxy-server=${proxy}`);
    }

    browser = await puppeteer.launch({
      headless: headless ? "new" : false,
      args,
      defaultViewport: { width: 1280, height: 800 },
      timeout: 120000,
    });
  } catch (e) {
    return res.status(500).json({ error: "Failed to launch browser: " + e.message });
  }

  try {
    const page = await browser.newPage();
    if (proxy && proxy.includes("@")) {
      const creds = proxy.split("@")[0];
      const [username, password] = creds.split(":");
      if (username && password) await page.authenticate({ username, password });
    }

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );
    await page.setDefaultNavigationTimeout(NAV_TIMEOUT);
    await page.setDefaultTimeout(Math.max(NAV_TIMEOUT, timeoutMs));

    await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT }).catch(() => {});

    const tokenSelector = 'input[name="cf-turnstile-response"], textarea[name="cf-turnstile-response"]';

    const tokenPresent = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return !!(el && el.value && el.value.length > 10);
    }, tokenSelector);

    if (!tokenPresent) {
      try {
        await page.waitForFunction(
          (sel) => {
            const el = document.querySelector(sel);
            return el && el.value && el.value.length > 10;
          },
          { timeout: timeoutMs },
          tokenSelector
        );
      } catch {
        /* no-op */
      }
    }

    await page.waitForTimeout(1000);

    const token = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.value : null;
    }, tokenSelector);

    const cookies = await page.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    await page.close();
    await browser.close();

    return res.json({
      success: true,
      domain: new URL(url).hostname,
      token: token || null,
      cookieHeader,
      cookies,
    });
  } catch (err) {
    try {
      await browser.close();
    } catch {}
    return res.status(500).json({ error: String(err.message || err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));