import express from "express";
import { Resolver } from "dns/promises";
import fs from "fs";

const PORT = 3000;
const app = express();
const resolver = new Resolver();

const domains = JSON.parse(fs.readFileSync("./config/domains.json", "utf8"));
const domainStatus = {};
let lastUpdateTime = new Date().toISOString();

// DNS resolve helper with error handling
async function resolveDNS(domain, timeoutMs = 2000) {
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

// checker loop per domain with conservative interval (3 seconds)
function startDomainChecker(domain, intervalMs = 3000) {
    console.log(`Starting checker for ${domain} with ${intervalMs}ms interval`);

    const loop = async () => {
        try {
            const result = await resolveDNS(domain);
            result.checkedAt = new Date().toISOString();

            // update memory
            domainStatus[domain] = result;
            lastUpdateTime = result.checkedAt;

            // Log successful resolution
            if (result.status === "ok") {
                console.log(`✓ ${domain} → ${result.ip} (${result.timeMs?.toFixed(1)}ms)`);
            } else {
                console.log(`✗ ${domain} → ${result.error}`);
            }
        } catch (err) {
            console.error(`Unexpected error in checker for ${domain}:`, err);
        }

        // Continue with interval (could add exponential backoff here if needed)
        setTimeout(loop, intervalMs);
    };

    loop();
}

// start all domain checkers with conservative 3-second interval
domains.forEach(d => startDomainChecker(d.trim(), 3000));

// middleware CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// REST API endpoints with enhanced response format
app.get("/api/domains", (req, res) => {
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

app.listen(PORT, () => {
    console.log(`🚀 DNS Monitor + Conservative REST API running on port ${PORT}`);
    console.log(`📊 Monitoring ${domains.length} domains every 3 seconds`);
    console.log(`⚡ API polling interval: 10 seconds (safe for production)`);
    console.log(`🔗 API endpoints: http://localhost:${PORT}/api/domains`);
});