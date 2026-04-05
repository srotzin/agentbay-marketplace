// Start script: seed if needed, then start server
import { existsSync } from "fs";
import { execSync } from "child_process";

const DB_PATH = "./data/agentbay.db";

if (!existsSync(DB_PATH)) {
  console.log("First run — seeding database...");
  execSync("node src/seed-expanded.js", { stdio: "inherit" });
}

// Start the server
import("./src/server.js");
