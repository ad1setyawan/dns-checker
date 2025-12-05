import express from "express";
import { Resolver } from "dns/promises";
import fs from "fs";

const PORT = 3000;
const app = express();
const resolver = new Resolver();

const domains = JSON.parse(fs.readFileSync("./config/domains.json", "utf8"));
const domainStatus = {};

// List client SSE connections
let clients = [];

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

// broadcast ke semua SSE clients
function broadcast(event) {
    const data = JSON.stringify(event);
    clients.forEach(res => res.write(`data: ${data}\n\n`));
}

// checker loop per domain
function startDomainChecker(domain, intervalMs = 5000) {
    console.log(`Starting checker for ${domain}`);

    const loop = async () => {
        const result = await resolveDNS(domain);
        result.checkedAt = new Date().toISOString();

        // update memory
        domainStatus[domain] = result;

        // kirim realtime ke SSE
        broadcast(result);

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

// SSE streaming endpoint
app.get("/stream", (req, res) => {
    // headers wajib untuk SSE
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.flushHeaders();

    // Tambahkan client ke list
    clients.push(res);
    console.log("SSE client connected. Total:", clients.length);

    // Kirim initial data
    res.write(`data: ${JSON.stringify({ connected: true, domains })}\n\n`);

    // cleanup jika koneksi terputus
    req.on("close", () => {
        clients = clients.filter(c => c !== res);
        console.log("SSE client disconnected. Total:", clients.length);
    });
});

app.listen(PORT, () => {
    console.log("DNS Monitor + SSE running on port " + PORT);
});