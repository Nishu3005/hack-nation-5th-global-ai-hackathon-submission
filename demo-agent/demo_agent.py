#!/usr/bin/env python3
"""
Nexus Demo Agent — Autonomous AI agent that pays Lightning invoices for intelligence.

Usage:
    python demo_agent.py "What is the current state of Lightning Network adoption?"
    python demo_agent.py --tier RESEARCH "Explain the agent economy and Bitcoin micropayments"
    python demo_agent.py --tier EXTRACT --urls "https://lightning.network" "https://bitcoin.org"
"""

import sys
import os
import json
import time
import hashlib
import argparse
import subprocess
from typing import Optional
import urllib.request
import urllib.error

NEXUS_API = os.environ.get("NEXUS_API_URL", "http://localhost:3000")
ALBY_ACCESS_TOKEN = os.environ.get("ALBY_ACCESS_TOKEN", "")
LIGHTNING_NODE_URL = os.environ.get("LIGHTNING_NODE_URL", "https://api.getalby.com")


def print_banner():
    print("\n" + "=" * 60)
    print("  ⚡ NEXUS DEMO AGENT — Autonomous Lightning Payment")
    print("  Hack-Nation 5th Global AI Hackathon — Team HN-0454")
    print("=" * 60 + "\n")


def http_post(url: str, body: dict, headers: Optional[dict] = None) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)

    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        try:
            return e.code, json.loads(body_bytes)
        except Exception:
            return e.code, {"error": body_bytes.decode("utf-8", errors="replace")}


def pay_lightning_invoice(bolt11: str) -> Optional[str]:
    """Pay a Lightning invoice via Alby API, return preimage."""
    print(f"  ⚡ Paying invoice: {bolt11[:40]}...")

    if not ALBY_ACCESS_TOKEN:
        print("  ⚠️  No ALBY_ACCESS_TOKEN — simulating payment for demo")
        # For demo without real Alby: derive a fake preimage from the bolt11
        fake_preimage = hashlib.sha256(bolt11.encode()).hexdigest()
        print(f"  [DEMO] Simulated preimage: {fake_preimage[:16]}...")
        time.sleep(0.5)
        return fake_preimage

    data = json.dumps({"invoice": bolt11}).encode("utf-8")
    req = urllib.request.Request(
        f"{LIGHTNING_NODE_URL}/payments/bolt11",
        data=data,
        method="POST"
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {ALBY_ACCESS_TOKEN}")

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            preimage = result.get("payment_preimage", result.get("preimage", ""))
            if preimage:
                print(f"  ✓ Payment confirmed! Preimage: {preimage[:16]}...")
                return preimage
            else:
                print(f"  ⚠️  No preimage in response: {result}")
                return None
    except Exception as e:
        print(f"  ✗ Payment failed: {e}")
        return None


def query_nexus_search(query: str, tier: str = "FLASH") -> Optional[dict]:
    """Full L402 flow: request → pay → retry with proof."""
    endpoint = f"{NEXUS_API}/api/v1/search"

    print(f"\n[Step 1] Calling {endpoint}")
    print(f"         Query: {query[:60]}...")
    print(f"         Tier:  {tier}")

    start = time.time()
    status, body = http_post(endpoint, {"query": query, "tier": tier})

    if status == 402:
        print(f"\n[Step 2] HTTP 402 — Payment Required")
        print(f"         Invoice: {body.get('invoice', '')[:60]}...")
        print(f"         Amount:  ⚡ {body.get('amountSats', '?')} sats")
        print(f"         Expires: {body.get('expiresAt', '?')}")

        invoice = body.get("invoice", "")
        macaroon = body.get("macaroon", "")
        amount_sats = body.get("amountSats", 0)

        print(f"\n[Step 3] Auto-paying Lightning invoice ({amount_sats} sats)...")
        preimage = pay_lightning_invoice(invoice)

        if not preimage:
            print("  ✗ Could not obtain preimage — aborting")
            return None

        print(f"\n[Step 4] Retrying with Authorization: L402 <macaroon>:<preimage>")
        status, body = http_post(
            endpoint,
            {"query": query, "tier": tier},
            headers={"Authorization": f"L402 {macaroon}:{preimage}"},
        )

    elapsed = time.time() - start

    if status == 200 and body.get("success"):
        print(f"\n[Step 5] ✓ SUCCESS — Response in {elapsed:.2f}s")
        return body.get("data")
    else:
        print(f"\n[Step 5] ✗ Failed (status={status}): {body}")
        return None


def query_nexus_research(query: str) -> None:
    """Stream research pipeline events via SSE."""
    import urllib.request

    endpoint = f"{NEXUS_API}/api/v1/research"
    print(f"\n[Research Mode] Query: {query[:60]}...")
    print("Streaming LangGraph pipeline events:\n")

    # First request without auth to get invoice
    status, body = http_post(endpoint, {"query": query})

    if status == 402:
        print(f"[402] Lightning invoice: ⚡ {body.get('amountSats', '?')} sats")
        invoice = body.get("invoice", "")
        macaroon = body.get("macaroon", "")
        preimage = pay_lightning_invoice(invoice)
        if not preimage:
            print("Payment failed")
            return
        auth = f"L402 {macaroon}:{preimage}"
    else:
        auth = None

    # Stream the research
    req = urllib.request.Request(endpoint, method="POST")
    req.add_header("Content-Type", "application/json")
    if auth:
        req.add_header("Authorization", auth)

    data = json.dumps({"query": query}).encode()
    req.data = data

    try:
        with urllib.request.urlopen(req) as resp:
            for line in resp:
                line = line.decode("utf-8").strip()
                if line.startswith("event:"):
                    event = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    raw = line.split(":", 1)[1].strip()
                    try:
                        d = json.loads(raw)
                    except Exception:
                        d = raw

                    if event == "node_start":
                        print(f"  → [{d.get('node', '?')}] started")
                    elif event == "node_complete":
                        print(f"  ✓ [{d.get('node', '?')}] complete")
                    elif event == "search_start":
                        print(f"    🔍 Searching: {str(d.get('question', ''))[:50]}")
                    elif event == "search_complete":
                        print(f"    📄 Got {d.get('count', '?')} results")
                    elif event == "result":
                        print(f"\n{'=' * 60}")
                        print("SYNTHESIS:")
                        print(d.get("synthesis", d))
                        print(f"\nConfidence: {d.get('confidence', '?')}%")
                        print(f"Sources: {d.get('citationCount', '?')} cited")
                    elif event == "done":
                        print(f"\n✓ Research complete!")
    except Exception as e:
        print(f"Stream error: {e}")


def display_results(data: dict, query: str, tier: str) -> None:
    if not data:
        return

    print(f"\n{'─' * 60}")
    print(f"Query: {query}")
    print(f"Tier:  {tier}")
    print(f"Cache: {'HIT' if data.get('fromCache') else 'MISS'}")
    print(f"Took:  {data.get('took', '?')}ms")

    if data.get("answer"):
        print(f"\nAnswer: {data['answer']}")

    results = data.get("results", [])
    print(f"\nTop {min(3, len(results))} results:")
    for i, r in enumerate(results[:3]):
        print(f"\n  [{i+1}] {r.get('title', 'Untitled')}")
        print(f"       {r.get('url', '')}")
        print(f"       {r.get('content', '')[:150]}...")


def main():
    global NEXUS_API
    print_banner()

    parser = argparse.ArgumentParser(description="Nexus Demo Agent — Autonomous L402 Lightning payment")
    parser.add_argument("query", nargs="?", default="What is the Lightning Network?", help="Search query")
    parser.add_argument("--tier", default="BASIC", choices=["FLASH", "BASIC", "DEEP", "RESEARCH", "EXTRACT"])
    parser.add_argument("--urls", nargs="+", help="URLs to extract (EXTRACT tier)")
    parser.add_argument("--api", default=NEXUS_API, help="Nexus API URL")
    args = parser.parse_args()

    NEXUS_API = args.api

    if args.tier == "RESEARCH":
        query_nexus_research(args.query)
    elif args.tier == "EXTRACT":
        urls = args.urls or ["https://lightning.network"]
        status, body = http_post(
            f"{NEXUS_API}/api/v1/extract",
            {"urls": urls},
        )
        if status == 402:
            print(f"[402] ⚡ {body.get('amountSats', '?')} sats required")
            invoice = body.get("invoice", "")
            macaroon = body.get("macaroon", "")
            preimage = pay_lightning_invoice(invoice)
            if preimage:
                status, body = http_post(
                    f"{NEXUS_API}/api/v1/extract",
                    {"urls": urls},
                    headers={"Authorization": f"L402 {macaroon}:{preimage}"},
                )
        if body.get("success"):
            print(f"\n✓ Extracted {len(body.get('data', {}).get('results', []))} pages")
            for r in body["data"]["results"]:
                print(f"\n  URL: {r['url']}")
                print(f"  Content ({len(r['content'])} chars): {r['content'][:200]}...")
    else:
        data = query_nexus_search(args.query, args.tier)
        if data:
            display_results(data, args.query, args.tier)

    print(f"\n{'=' * 60}")
    print("Agent run complete. This is the autonomous agent economy.")
    print("No human clicked anything. Bitcoin settled the payment.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    main()
