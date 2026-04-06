// Start script: seed if needed, then start server
import { existsSync } from "fs";
import { execSync } from "child_process";

const DB_PATH = "./data/agentbay.db";

if (!existsSync(DB_PATH)) {
  console.log("First run — seeding database...");
  execSync("node src/seed-expanded.js", { stdio: "inherit" });
  console.log("Seeding variants...");
  execSync("node src/seed-variants.js", { stdio: "inherit" });
  console.log("Seeding AI-requested services...");
  execSync("node src/seed-ai-services.js", { stdio: "inherit" });
}

// Start the server
import("./src/server.js");
