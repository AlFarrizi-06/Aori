const express = require("express");
const path = require("path");
const cors = require("cors");

class WebServer {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.server = null;

        // 🚨 Railway: JANGAN pakai fallback port custom
        this.port = Number(process.env.PORT);

        if (!this.port) {
            throw new Error("PORT environment variable is required");
        }

        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.set("trust proxy", true);

        this.app.use(cors({
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        }));

        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        this.app.use((req, res, next) => {
            console.log(`[Web] ${req.method} ${req.path}`);
            next();
        });

        this.app.use(express.static(path.join(__dirname, "public")));

        this.app.set("view engine", "ejs");
        this.app.set("views", path.join(__dirname, "views"));

        this.app.use((req, res, next) => {
            req.client = this.client;
            next();
        });
    }

    setupRoutes() {
        // ✅ Root route (Railway health check)
        this.app.get("/", (req, res) => {
            res.json({
                status: "online",
                bot: this.client.user?.tag || "Starting...",
                uptime: this.client.uptime || 0
            });
        });

        this.app.get("/health", (req, res) => {
            res.status(200).json({
                status: "online",
                bot: this.client.user?.tag || "Starting...",
                timestamp: Date.now()
            });
        });

        try {
            const indexRoutes = require("./routes/index");
            const apiRoutes = require("./routes/api");

            this.app.use("/", indexRoutes);
            this.app.use("/api", apiRoutes);
        } catch (err) {
            console.warn("[Web] Routes failed to load, using fallback");
        }

        this.app.use((req, res) => {
            res.status(404).json({
                error: "Not Found",
                path: req.path
            });
        });

        this.app.use((err, req, res, next) => {
            console.error("[Web] Error:", err);
            res.status(500).json({ error: "Internal Server Error" });
        });
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, "0.0.0.0", () => {
                console.log("[Web] ====================================");
                console.log("[Web] 🌐 Web Server is RUNNING");
                console.log(`[Web] 📍 Listening on PORT ${this.port}`);
                console.log("[Web] ====================================");
                resolve();
            });

            this.server.on("error", (err) => {
                console.error("[Web] Server error:", err);
                reject(err);
            });
        });
    }

    stop() {
        if (this.server) {
            this.server.close(() => {
                console.log("[Web] Server stopped");
            });
        }
    }
}

module.exports = WebServer;
