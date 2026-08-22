/**
 * ResourceAnalyzer — Detects and profiles system hardware capabilities
 *
 * Analyzes CPU, GPU, RAM, disk, network, and platform to determine
 * what compute workloads the node can support.
 */

const os = require("os");
const { execSync } = require("child_process");
const fs = require("fs");

class ResourceAnalyzer {
    constructor() {
        this._cache = null;
        this._cacheTime = 0;
        this.CACHE_TTL = 30_000; // 30 seconds
    }

    /**
     * Full system profile — cached for 30s to avoid repeated syscalls
     */
    async analyze() {
        const now = Date.now();
        if (this._cache && (now - this._cacheTime) < this.CACHE_TTL) {
            return this._cache;
        }

        const profile = {
            platform: this._getPlatform(),
            cpu: this._getCPU(),
            memory: this._getMemory(),
            disk: this._getDisk(),
            gpu: this._getGPU(),
            network: this._getNetwork(),
            capabilities: [],
            score: 0,
            timestamp: new Date().toISOString(),
        };

        profile.capabilities = this._deriveCapabilities(profile);
        profile.score = this._computeScore(profile);

        this._cache = profile;
        this._cacheTime = now;
        return profile;
    }

    /**
     * Real-time resource usage (no caching)
     */
    getUsage() {
        const cpus = os.cpus();
        const loadAvg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();

        return {
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model || "unknown",
                loadAvg: {
                    "1m": loadAvg[0],
                    "5m": loadAvg[1],
                    "15m": loadAvg[2],
                },
                usagePercent: Math.round((loadAvg[0] / cpus.length) * 100),
            },
            memory: {
                totalGB: (totalMem / 1024 ** 3).toFixed(1),
                freeGB: (freeMem / 1024 ** 3).toFixed(1),
                usedGB: ((totalMem - freeMem) / 1024 ** 3).toFixed(1),
                usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
            },
            uptime: os.uptime(),
        };
    }

    /**
     * Check if system meets minimum requirements for a workload type
     */
    meetsRequirements(workloadType) {
        const REQUIREMENTS = {
            inference:   { minRAM_GB: 8,  minCores: 4,  requiresGPU: true,  minVRAM_GB: 8 },
            render:      { minRAM_GB: 16, minCores: 4,  requiresGPU: true,  minVRAM_GB: 12 },
            federated_learning: { minRAM_GB: 8,  minCores: 4,  requiresTEE: true },
            edge:        { minRAM_GB: 1,  minCores: 1,  requiresGPU: false },
            zk_prover:   { minRAM_GB: 4,  minCores: 4,  requiresGPU: true,  minVRAM_GB: 6 },
            game:        { minRAM_GB: 8,  minCores: 4,  requiresGPU: true,  minVRAM_GB: 4 },
            science:     { minRAM_GB: 16, minCores: 8,  requiresGPU: false },
            privacy:     { minRAM_GB: 4,  minCores: 2,  requiresTEE: true },
            node:        { minRAM_GB: 2,  minCores: 2,  requiresGPU: false },
            storage:     { minRAM_GB: 2,  minCores: 2,  requiresGPU: false, minDisk_GB: 100 },
            file_server: { minRAM_GB: 4,  minCores: 2,  requiresGPU: false, minDisk_GB: 50, requiresNetwork: true },
            rewarded:    { minRAM_GB: 1,  minCores: 1,  requiresGPU: false },
        };

        const req = REQUIREMENTS[workloadType];
        if (!req) return { eligible: false, reason: `Unknown workload type: ${workloadType}` };

        const profile = this._cache || { cpu: {}, memory: {}, gpu: {} };
        const reasons = [];

        if (profile.memory?.totalGB < req.minRAM_GB) {
            reasons.push(`Need ${req.minRAM_GB}GB RAM, have ${profile.memory?.totalGB}GB`);
        }
        if (profile.cpu?.cores < req.minCores) {
            reasons.push(`Need ${req.minCores} cores, have ${profile.cpu?.cores}`);
        }
        if (req.requiresGPU && (!profile.gpu || profile.gpu.length === 0)) {
            reasons.push("GPU required but not detected");
        }
        if (req.minVRAM_GB && profile.gpu?.[0]?.vramGB < req.minVRAM_GB) {
            reasons.push(`Need ${req.minVRAM_GB}GB VRAM, have ${profile.gpu?.[0]?.vramGB || 0}GB`);
        }
        if (req.requiresTEE && !profile.cpu?.hasTEE) {
            reasons.push("TEE (SGX/SEV) required but not available");
        }
        if (req.minDisk_GB && profile.disk?.freeGB < req.minDisk_GB) {
            reasons.push(`Need ${req.minDisk_GB}GB free disk, have ${profile.disk?.freeGB || 0}GB`);
        }
        if (req.requiresNetwork && !profile.network?.hasPublicIP) {
            reasons.push("Public network access required but not detected");
        }

        return {
            eligible: reasons.length === 0,
            reason: reasons.join("; ") || "All requirements met",
            requirements: req,
        };
    }

    // ── Internal detection methods ──────────────────────────────

    _getPlatform() {
        return {
            os: os.type(),
            arch: os.arch(),
            release: os.release(),
            hostname: os.hostname(),
            nodeVersion: process.version,
        };
    }

    _getCPU() {
        const cpus = os.cpus();
        const model = cpus[0]?.model || "unknown";
        const hasAVX2 = /avx2/i.test(model);
        const hasAVX512 = /avx-512/i.test(model);
        const hasSSE4 = /sse4/i.test(model);

        return {
            model,
            cores: cpus.length,
            speed: cpus[0]?.speed || 0,
            features: {
                avx2: hasAVX2,
                avx512: hasAVX512,
                sse4: hasSSE4,
            },
            hasTEE: this._detectTEE(),
        };
    }

    _getMemory() {
        const total = os.totalmem();
        return {
            totalGB: parseFloat((total / 1024 ** 3).toFixed(1)),
            totalBytes: total,
        };
    }

    _getDisk() {
        try {
            if (os.platform() === "win32") {
                const output = execSync(
                    'wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /format:csv',
                    { encoding: "utf8", timeout: 5000 }
                );
                const lines = output.trim().split("\n").filter(l => l.includes(","));
                if (lines.length > 0) {
                    const parts = lines[lines.length - 1].split(",");
                    const free = parseInt(parts[1]) || 0;
                    const total = parseInt(parts[2]) || 0;
                    return { totalGB: (total / 1024 ** 3).toFixed(1), freeGB: (free / 1024 ** 3).toFixed(1) };
                }
            } else {
                const output = execSync("df -BG / | tail -1", { encoding: "utf8", timeout: 5000 });
                const parts = output.trim().split(/\s+/);
                return { totalGB: parseInt(parts[1]), freeGB: parseInt(parts[3]) };
            }
        } catch {
            return { totalGB: 0, freeGB: 0 };
        }
    }

    _getGPU() {
        const gpus = [];

        // NVIDIA detection
        try {
            const smi = execSync("nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits", {
                encoding: "utf8", timeout: 5000,
            });
            smi.trim().split("\n").forEach(line => {
                const [name, vram, driver, compute] = line.split(",").map(s => s.trim());
                gpus.push({
                    vendor: "nvidia",
                    name,
                    vramGB: parseInt(vram) || 0,
                    driver,
                    computeCapability: compute,
                    cuda: true,
                    vulkan: false,
                    metal: false,
                });
            });
        } catch { /* nvidia-smi not available */ }

        // AMD/Intel via lspci (Linux)
        if (gpus.length === 0 && os.platform() !== "win32") {
            try {
                const lspci = execSync("lspci | grep -i 'vga\\|3d\\|display'", {
                    encoding: "utf8", timeout: 5000,
                });
                lspci.trim().split("\n").forEach(line => {
                    const name = line.split(": ").slice(1).join(": ").trim();
                    gpus.push({
                        vendor: /amd|radeon/i.test(name) ? "amd" : /intel/i.test(name) ? "intel" : "unknown",
                        name,
                        vramGB: 0,
                        cuda: false,
                        vulkan: /amd|radeon/i.test(name),
                        metal: false,
                    });
                });
            } catch { /* lspci not available */ }
        }

        // Metal (macOS)
        if (gpus.length === 0 && os.platform() === "darwin") {
            try {
                const sp = execSync("system_profiler SPDisplaysDataType -json", { encoding: "utf8", timeout: 5000 });
                const data = JSON.parse(sp);
                const displays = data?.SPDisplaysDataType?.[0]?.spdisplays_ndvs || [];
                displays.forEach(d => {
                    gpus.push({
                        vendor: "apple",
                        name: d._name || "Apple GPU",
                        vramGB: 0,
                        metal: true,
                        cuda: false,
                        vulkan: false,
                    });
                });
            } catch { /* system_profiler not available */ }
        }

        return gpus;
    }

    _getNetwork() {
        const interfaces = os.networkInterfaces();
        const addresses = [];
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal) {
                    addresses.push({ interface: name, address: addr.address, family: addr.family });
                }
            }
        }
        return { interfaces: addresses, hasPublicIP: addresses.length > 0 };
    }

    _detectTEE() {
        if (os.platform() === "linux") {
            try {
                const sgx = fs.existsSync("/dev/sgx_enclave");
                const sev = fs.existsSync("/dev/sev");
                return sgx || sev;
            } catch { return false; }
        }
        return false;
    }

    _deriveCapabilities(profile) {
        const caps = [];

        // CPU features
        if (profile.cpu?.features?.avx512) caps.push("avx512");
        if (profile.cpu?.features?.avx2) caps.push("avx2");
        if (profile.cpu?.features?.sse4) caps.push("sse4");
        if (profile.cpu?.hasTEE) caps.push("tee", "sgx");

        // GPU features
        for (const gpu of profile.gpu || []) {
            if (gpu.cuda) { caps.push("gpu", "cuda"); if (gpu.computeCapability) caps.push(`cuda_${gpu.computeCapability}`); }
            if (gpu.vulkan) caps.push("vulkan");
            if (gpu.metal) caps.push("metal");
        }

        // Memory tier
        if (profile.memory?.totalGB >= 64) caps.push("highmem");
        else if (profile.memory?.totalGB >= 16) caps.push("midmem");

        return [...new Set(caps)];
    }

    _computeScore(profile) {
        let score = 0;

        // CPU score (0-30)
        score += Math.min(profile.cpu?.cores || 0, 16) * 1.5;
        if (profile.cpu?.features?.avx512) score += 5;
        if (profile.cpu?.features?.avx2) score += 3;

        // Memory score (0-25)
        score += Math.min((profile.memory?.totalGB || 0) / 4, 25);

        // GPU score (0-35)
        for (const gpu of profile.gpu || []) {
            score += Math.min((gpu.vramGB || 0) / 2, 20);
            if (gpu.cuda) score += 10;
            if (gpu.metal) score += 8;
            if (gpu.vulkan) score += 6;
        }

        // TEE bonus (0-10)
        if (profile.cpu?.hasTEE) score += 10;

        // Disk score (0-10)
        score += Math.min((profile.disk?.freeGB || 0) / 50, 10);

        return Math.round(Math.min(score, 100));
    }
}

module.exports = { ResourceAnalyzer };
