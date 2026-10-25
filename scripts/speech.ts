import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
loadEnvConfig(process.cwd());
const secret = process.env.VOICE_STT_TOKEN || (process.env.MEMORY_SERVICE_TOKEN ? createHmac("sha256", process.env.MEMORY_SERVICE_TOKEN).update("haven-local-speech").digest("hex") : "");
if (!secret) throw new Error("Configure VOICE_STT_TOKEN or MEMORY_SERVICE_TOKEN first.");
const child = spawn(process.env.VOICE_PYTHON || "python3", ["services/speech/server.py"], { stdio: "inherit", env: { ...process.env, HF_HUB_DISABLE_XET: "1", VOICE_STT_TOKEN: secret } });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code || 0; });
