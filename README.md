# Aspire Inventory Management System (Version 4)

A complete Next.js inventory app with CRUD, status tracking, search, role-based access control, and AI-inspired assistant features.

## Tech Stack

- Next.js (App Router, TypeScript)
- React
- Tailwind CSS
- PostgreSQL
- Prisma ORM

## Features Implemented

### Core Inventory Management
- Add inventory items
- Edit inventory items
- Delete inventory items (role-restricted)
- Item fields include:
	- name
	- quantity
	- category
	- status
	- SKU
	- reorder level
	- supplier
	- location
	- notes

### Status Tracking
Supported statuses:
- in stock
- low stock
- ordered
- discontinued

### Search & Filters
- Keyword search across name/category/status/SKU/location/supplier/notes
- Filter by status
- Filter by category

### Role-Based Access Control (RBAC)
Roles:
- admin: create/edit/delete
- manager: create/edit
- procurement: create/edit
- viewer: read-only

Demo users:
- admin / admin123
- manager / manager123
- buyer / buyer123
- viewer / viewer123

### AI-Inspired Features
- **AI category suggestion:** auto-suggests category from item name keywords
- **AI restock insights:** prioritizes risk and recommends how many units to reorder

### Extra Features
- Dashboard summary cards (total, low stock, ordered, discontinued)
- Database persistence using PostgreSQL

---

## How to Run

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

Copy .env.example to .env and set DATABASE_URL.

3. Run Prisma migration + generate client:

```bash
npm run prisma:migrate
npm run prisma:generate
```

4. Start dev server:

```bash
npm run dev
```

5. Open:

http://localhost:3000

## Production Build

```bash
npm run build
npm run start
```

## Deploy (Vercel)

This Next.js app is deployment-ready.

```bash
npx vercel
```

After deployment, Vercel prints the live URL.

## Source Code

All source is included in this repository.
