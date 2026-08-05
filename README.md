<div align="center">
  <h1>🚀 Conexus</h1>
  <p><strong>Next-Generation AI-Powered IPO Documentation Platform</strong></p>

  <!-- Badges -->
  <p>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" />
    <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
    <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
    <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=googlebard&logoColor=white" alt="Gemini" />
  </p>
</div>

<br />

> Conexus is an enterprise-grade, AI-native platform designed to streamline, automate, and accelerate the Initial Public Offering (IPO) documentation and compliance lifecycle. It leverages Retrieval-Augmented Generation (RAG) and Google Gemini AI to simplify regulatory review against ICDR standards.

## 📑 Table of Contents
- [✨ Key Features](#-key-features)
- [🏗️ Architecture & Tech Stack](#-architecture--tech-stack)
- [💻 Local Development Guide](#-local-development-guide)
- [🔮 AI Engine & RAG](#-ai-engine--rag)
- [📜 License](#-license)

---

## ✨ Key Features

- **Document Parsing & OCR**  
  Intelligent ingestion of IPO prospectuses and documents (PDFs) with built-in fallback mechanisms for flawless text extraction.
  
- **Autonomous Validation Engine**  
  Automatically cross-references uploaded sections against live ICDR regulatory corpora using advanced vector search (`pgvector`) and contextual Gemini evaluation.

- **Asynchronous Gap Analysis**  
  Runs deep, asynchronous analysis via **Inngest** to detect missing requirements, checklist items, and critical regulatory gaps without blocking the user.

- **Premium Interactive Dashboard**  
  A highly polished, responsive interface built with `shadcn/ui`, interactive 3D carousels, and fluid **GSAP / Framer Motion** animations.

- **One-Click Export**  
  Instantly compile and export compliance reports and IPO documentation directly into polished `.docx` formats.

---

## 🏗️ Architecture & Tech Stack

| Category | Technology |
|---|---|
| **Frontend** | [Next.js App Router](https://nextjs.org/), [React 18](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| **UI Components**| [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), [GSAP](https://gsap.com/) |
| **Backend** | [Next.js Server Actions / APIs](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) |
| **Database** | [Supabase](https://supabase.com/) (PostgreSQL + `pgvector`), [Prisma ORM](https://www.prisma.io/) |
| **Background Jobs**| [Inngest](https://www.inngest.com/) |
| **AI / LLMs** | [Google Gemini 1.5 Pro](https://ai.google.dev/), Gemini Text Embeddings |

---

## 💻 Local Development Guide

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **pnpm**

### 2. Environment Variables
Create a `.env` file in the root directory. You must acquire the secure credentials from your team lead:

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres.[YOUR_PROJECT]:[YOUR_PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Auth / Client
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# AI Integration
GEMINI_API_KEY="your-google-gemini-key"
```

### 3. Installation
```bash
npm install
```

### 4. Database Setup & AI Vector Seeding
*(Skip this step if you are connecting directly to a shared team database that is already seeded.)*

To initialize your own local/remote database schema and populate the compliance vector database:
```bash
npx prisma db push
npx tsx src/compliance/icdr-corpus/seed.ts
```

### 5. Running the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Starting the Background Workers (Inngest)
For features like **Gap Analysis** to execute, you must run the background event server. In a **new terminal tab**, run:
```bash
npx inngest-cli@latest dev
```
This bridges your local Next.js APIs with background queues.

---

## 🔮 AI Engine & RAG (Retrieval-Augmented Generation)

Conexus uses **Google Gemini 1.5 Pro** and the **Gemini Text Embeddings** model (`gemini-embedding-001`, 3072 dimensions) paired with Supabase `pgvector`. 
When a document is uploaded, it is embedded, stored, and cross-examined asynchronously to detect missing regulatory conditions and highlight compliance violations instantly.

---

<div align="center">
  <p>Built with ❤️ by the Conexus Team.</p>
</div>
