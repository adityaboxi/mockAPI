# ⚡ MockAPI — High-Performance Distributed Mock Engine & Telemetry Platform

<div align="center">

![Architecture](https://img.shields.io/badge/Architecture-Distributed%20Microservices-blue?style=for-the-badge&logo=docker)
![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20Vite%20%7C%20Tailwind-61DAFB?style=for-the-badge&logo=react)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20BullMQ-339933?style=for-the-badge&logo=node.js)
![Gateway](https://img.shields.io/badge/Gateway-OpenResty%20%2B%20Lua-009900?style=for-the-badge&logo=nginx)
![Telemetry](https://img.shields.io/badge/Observability-OpenTelemetry%20Distributed%20Tracing-F54A00?style=for-the-badge&logo=opentelemetry)
![CI/CD](https://img.shields.io/badge/CI%2FCD-Self--Healing%20GitHub%20Actions-2088FF?style=for-the-badge&logo=githubactions)

**An enterprise-grade, cloud-native distributed mock API builder, simulation gateway, and real-time OpenTelemetry observability engine.**

</div>

---

## 📖 Table of Contents
1. [System Overview](#-system-overview)
2. [Architecture Topology Diagram](#-architecture-topology-diagram)
3. [Microservices Breakdown](#-microservices-breakdown)
4. [Request Lifecycles & Data Flows](#-request-lifecycles--data-flows)
   - [A. Dynamic Mock Invocation Flow](#a-dynamic-mock-invocation-flow)
   - [B. AI-Powered Schema Blueprinting](#b-ai-powered-schema-blueprinting)
   - [C. Real-time Telemetry & Micro-Batch Log Stream](#c-real-time-telemetry--micro-batch-log-stream)
5. [Complete Technology Stack](#-complete-technology-stack)
6. [Security & Authentication Model](#-security--authentication-model)
7. [Environment Configuration Reference](#-environment-configuration-reference)
8. [Self-Healing CI/CD Pipeline](#-self-healing-cicd-pipeline)
9. [Local Development & Docker Deployment](#-local-development--docker-deployment)

---

## 🌟 System Overview

**MockAPI** is an all-in-one mocking and simulation ecosystem designed to emulate complex REST APIs with dynamic route parameters, custom headers, artificial latency injection, simulated rate-limiting, DoS protection, and authentication enforcement (Bearer token & API key).

### Key Platform Highlights:
* 🚦 **High-Throughput Gateway**: OpenResty Lua ingress handling sub-millisecond route resolution via internal Redis key stores.
* 🤖 **Multi-Tier AI Blueprint Generation**: Cascading generator using Google Gemini, Groq Llama 3.3, and local deterministic semantic engines with 1-click revert capability.
* 📊 **Universal OpenTelemetry Tracing**: Real-time distributed tracing, HTTP span interception, rolling latency calculations, and live WebSocket topology graph.
* 🛡️ **DoS Mitigation & Auto-Ban**: Dynamic rate-limit thresholding that bans aggressive IPs for 24 hours in MongoDB and notifies workspace teams via SMTP.
* 🚀 **Zero-Downtime Self-Healing Pipeline**: Differential GitHub Actions deployment pipeline that updates individual microservices in-place without restarting unaffected stacks.

---

## 🗺️ Architecture Topology Diagram

```mermaid
flowchart TB
    subgraph IngressLayer ["🌐 Ingress & Traffic Management"]
        Client["Browser Client / Dashboard (Port 8082)"]
        DomainProxy["Nginx Domain Proxy / SSL (Port 80 / 443)"]
        OpenResty["OpenResty Gateway + Lua (Port 8080)"]
    end

    subgraph AppPlane ["⚙️ Application & Orchestration Plane"]
        ServerNginx["Backend API Nginx (Port 8081)"]
        ExpressApp["Express Core Server (Port 3000)"]
        BullMQWorker["BullMQ Worker Cluster (AI & Background)"]
    end

    subgraph MockPlane ["🚀 Mock Execution & Worker Pool"]
        WorkerServer["Worker-Server (Dynamic Engine)"]
        WorkerLogs["Worker-Logs (Micro-Batch Ingester)"]
        WorkerHealth["Worker-Health (Watchdog)"]
    end

    subgraph DataPlane ["💾 Distributed Storage & Cache Layer"]
        MongoDB[("🍃 MongoDB Database")]
        RedisExt[("⚡ External Redis 6379 (BullMQ / PubSub)")]
        RedisInt[("⚡ Internal Redis 6379 (Routes / Locks)")]
    end

    subgraph TelemetryPlane ["📊 Observability & Distributed Tracing"]
        OTelLogger["Universal Logger (OTel Instrumentation)"]
        TelemetryServer["Telemetry Ingest Server (Port 3003)"]
        TelemetryUI["Live Telemetry Topology UI (Port 8083)"]
    end

    %% Ingress routing
    DomainProxy -->|/api & WebSockets| ServerNginx
    DomainProxy -->|/mock/*| OpenResty
    DomainProxy -->|Frontend Assets| Client
    Client --> ServerNginx

    %% Core App
    ServerNginx --> ExpressApp
    ExpressApp --> MongoDB
    ExpressApp --> RedisExt
    ExpressApp --> RedisInt
    ExpressApp --> BullMQWorker

    %% Mock routing
    OpenResty -->|Fast Route Cache Check| RedisInt
    OpenResty -->|Proxy Execution| WorkerServer
    WorkerServer --> MongoDB
    WorkerServer --> RedisInt
    WorkerServer -->|Publish Raw Logs| RedisInt
    RedisInt --> WorkerLogs
    WorkerLogs -->|Micro-Batch InsertMany| MongoDB

    %% Telemetry Stream
    ExpressApp -.->|Traces & Spans| OTelLogger
    WorkerServer -.->|Traces & Spans| OTelLogger
    OTelLogger -.->|HTTP Ingest| TelemetryServer
    TelemetryServer -.->|WebSockets| TelemetryUI