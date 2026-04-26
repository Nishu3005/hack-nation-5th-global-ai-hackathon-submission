import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "opossum",
    "@prisma/adapter-pg",
    "pg",
    "@langchain/langgraph",
    "@langchain/langgraph-checkpoint",
    "@langchain/core",
    "@langchain/anthropic",
    "langchain",
    "@anthropic-ai/sdk",
  ],
};

export default nextConfig;
