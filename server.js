import express from "express";
import { Resolver } from "dns/promises";
import fs from "fs";

const PORT = 3000;
const app = express();
const resolver = new Resolver();

const domains = JSON.parse(fs.readFileSync("./config/domains.json", "utf8"));
const domainStatus = {};

// DNS resolve helper
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
        return { domain, status: "failed", error: err.code || err.message };
    }
}

// checker loop per domain
function startDomainChecker(domain, intervalMs = 5000) {
    console.log(`Starting checker for ${domain}`);

    const loop = async () => {
        const result = await resolveDNS(domain);
        result.checkedAt = new Date().toISOString();

        // update memory
        domainStatus[domain] = result;

        setTimeout(loop, intervalMs);
    };

    loop();
}

// start all domain checkers
domains.forEach(d => startDomainChecker(d.trim(), 5000));

// middleware CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// REST API endpoints
app.get("/api/domains", (req, res) => {
    res.json(domainStatus);
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
    console.log("DNS Monitor + REST API running on port " + PORT);
});