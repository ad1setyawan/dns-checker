import express from "express";
import { Resolver } from "dns/promises";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const DNS_TIMEOUT_MS = parseInt(process.env.DNS_TIMEOUT_MS) || 2000;
const CHECK_INTERVAL_MS = parseInt(process.env.CHECK_INTERVAL_MS) || 3000;
const DISCORD_FAILURE_THRESHOLD = parseInt(process.env.DISCORD_FAILURE_THRESHOLD) || 3;
const DISCORD_ENABLED = process.env.DISCORD_ENABLED === 'true';
const DISCORD_MENTION_USERS = process.env.DISCORD_MENTION_USERS || '@here';
const app = express();
const resolver = new Resolver();

const domains = JSON.parse(fs.readFileSync("./config/domains.json", "utf8"));
const domainStatus = {};
let lastUpdateTime = new Date().toISOString();

// DNS resolve helper with error handling
async function resolveDNS(domain, timeoutMs = DNS_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const start = performance.now();

    try {
        const ip4 = await resolver.resolve4(domain, { signal: controller.signal });
        const timeMs = performance.now() - start;

        clearTimeout(timeout);
        return { domain, status: "ok", ip: ip4[0], timeMs };
    } catch (err) {
        clearTimeout(timeout);
        const errorType = err.code || 'UNKNOWN_ERROR';
        let errorMessage = err.message;

        // Log DNS failures for monitoring
        console.warn(`DNS resolution failed for ${domain}: ${errorType} - ${errorMessage}`);

        return { domain, status: "failed", error: errorMessage, errorCode: errorType };
    }
}

// Discord notification function
async function sendDiscordNotification(domain, result, failureCount) {
    if (!DISCORD_ENABLED || !process.env.DISCORD_WEBHOOK_URL) {
        console.log(`Discord notification skipped - Discord disabled or webhook URL not configured`);
        return;
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    const message = {
        content: `${DISCORD_MENTION_USERS}`,
        embeds: [{
            title: `Domain: ${domain}`,
            description: `Failed ${failureCount} consecutive DNS checks`,
            color: 0xFF0000,
            fields: [
                { name: "Error", value: result.error, inline: false },
                { name: "Error Code", value: result.errorCode, inline: true },
                { name: "Last Checked", value: result.checkedAt, inline: true }
            ],
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
            signal: AbortSignal.timeout(5000) // 5 second timeout for webhook
        });

        if (!response.ok) {
            console.error(`Discord webhook failed with status: ${response.status}`);
        } else {
            console.log(`✅ Discord notification sent for ${domain}`);
        }
    } catch (error) {
        console.error(`Failed to send Discord notification for ${domain}:`, error.message);
    }
}

// checker loop per domain with configurable interval
function startDomainChecker(domain, intervalMs = CHECK_INTERVAL_MS) {
    console.log(`Starting checker for ${domain} with ${intervalMs}ms interval`);

    const loop = async () => {
        try {
            const result = await resolveDNS(domain);
            result.checkedAt = new Date().toISOString();

            // Initialize or get existing status for this domain
            if (!domainStatus[domain]) {
                domainStatus[domain] = {
                    consecutiveFailures: 0,
                    notificationSent: false
                };
            }

            // Update result with failure tracking
            if (result.status === "ok") {
                // Reset failure tracking on success
                domainStatus[domain] = {
                    ...result,
                    consecutiveFailures: 0,
                    notificationSent: false
                };
                console.log(`✓ ${domain} → ${result.ip} (${result.timeMs?.toFixed(1)}ms)`);
            } else {
                // Increment failure counter
                const currentFailures = (domainStatus[domain].consecutiveFailures || 0) + 1;

                domainStatus[domain] = {
                    ...result,
                    consecutiveFailures: currentFailures,
                    notificationSent: domainStatus[domain].notificationSent || false
                };

                console.log(`✗ ${domain} → ${result.error} (${currentFailures} consecutive failures)`);

                // Check threshold and send notification
                if (currentFailures >= DISCORD_FAILURE_THRESHOLD &&
                    !domainStatus[domain].notificationSent) {
                    await sendDiscordNotification(domain, result, currentFailures);
                    domainStatus[domain].notificationSent = true;
                    domainStatus[domain].lastNotifiedAt = new Date().toISOString();
                }
            }

            // Update last update time
            lastUpdateTime = domainStatus[domain].checkedAt;

        } catch (err) {
            console.error(`Unexpected error in checker for ${domain}:`, err);
        }

        // Continue with interval
        setTimeout(loop, intervalMs);
    };

    loop();
}

// start all domain checkers with configurable interval
domains.forEach(d => startDomainChecker(d.trim(), CHECK_INTERVAL_MS));

// middleware CORS
app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// REST API endpoints with enhanced response format
app.get("/api/domains", (_req, res) => {
    res.json({
        lastUpdated: lastUpdateTime,
        domains: domains,
        data: domainStatus,
        checkInterval: "3s",
        pollInterval: "10s"
    });
});

app.get("/api/domains/:domain", (req, res) => {
    const domain = req.params.domain;
    const result = domainStatus[domain];

    if (result) {
        res.json(result);
    } else {
        res.status(404).json({ error: "Domain not found or not yet checked" });
    }
});

// Test Discord notification endpoint
app.post("/api/test/discord", async (_req, res) => {
    try {
        // Create a test failure result
        const testResult = {
            domain: "test.example.com",
            status: "failed",
            error: "Test DNS failure - This is a test notification",
            errorCode: "ENOTFOUND",
            checkedAt: new Date().toISOString()
        };

        console.log("🧪 Sending test Discord notification...");
        await sendDiscordNotification("test.example.com", testResult, 3);

        res.json({
            success: true,
            message: "Test Discord notification sent successfully",
            discordEnabled: DISCORD_ENABLED,
            webhookConfigured: !!process.env.DISCORD_WEBHOOK_URL,
            mentionUsers: DISCORD_MENTION_USERS,
            testResult: testResult
        });
    } catch (error) {
        console.error("❌ Test Discord notification failed:", error);
        res.status(500).json({
            success: false,
            message: "Test Discord notification failed",
            error: error.message,
            discordEnabled: DISCORD_ENABLED,
            webhookConfigured: !!process.env.DISCORD_WEBHOOK_URL,
            mentionUsers: DISCORD_MENTION_USERS
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 DNS Monitor + Conservative REST API running on port ${PORT}`);
    console.log(`📊 Monitoring ${domains.length} domains every 3 seconds`);
    console.log(`⚡ API polling interval: 10 seconds (safe for production)`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/domains`);
    console.log(`🧪 Test Discord notification: POST http://localhost:${PORT}/api/test/discord`);
});