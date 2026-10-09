import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDatabase } from "./db";
import { router } from "./routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database and tables
initDatabase();

// Mount API routes
app.use("/api", router);

// Root health check
app.get("/", (req, res) => {
  res.json({
    app: "PayPal DisputeShield AI - Backend",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      disputes: "/api/disputes",
      stats: "/api/stats",
      simulate: "POST /api/simulate-dispute"
    }
  });
});

app.listen(PORT, () => {
  console.log(`[DisputeShield AI] Server running on http://localhost:${PORT}`);
  console.log(`[PayPal Sandbox Engine] Configured and ready for dispute autopilot.`);
});
