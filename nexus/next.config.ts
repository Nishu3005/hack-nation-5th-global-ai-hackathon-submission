import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "opossum",
    "@langchain/langgraph",
    "@langchain/langgraph-checkpoint",
    "@langchain/core",
    "@langchain/anthropic",
    "langchain",
    "@anthropic-ai/sdk",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
  ],
};

export default nextConfig;
