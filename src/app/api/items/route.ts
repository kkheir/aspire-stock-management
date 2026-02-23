import { Prisma, StockStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ItemPayload = {
  name: string;
  sku: string;
  quantity: number;
  category: string;
  status: "in stock" | "low stock" | "ordered" | "discontinued";
  reorderLevel: number;
  location: string;
  supplier: string;
  notes: string;
};

const STATUS_TO_DB: Record<ItemPayload["status"], StockStatus> = {
  "in stock": StockStatus.in_stock,
  "low stock": StockStatus.low_stock,
  ordered: StockStatus.ordered,
  discontinued: StockStatus.discontinued,
};

const STATUS_FROM_DB: Record<StockStatus, ItemPayload["status"]> = {
  [StockStatus.in_stock]: "in stock",
  [StockStatus.low_stock]: "low stock",
  [StockStatus.ordered]: "ordered",
  [StockStatus.discontinued]: "discontinued",
};

function toClientItem(item: {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  category: string;
  status: StockStatus;
  reorderLevel: number;
  location: string;
  supplier: string;
  notes: string;
  updatedAt: Date;
}) {
  return {
    ...item,
    status: STATUS_FROM_DB[item.status],
    updatedAt: item.updatedAt.toISOString(),
  };
}

async function ensureSeedData() {
  const count = await prisma.inventoryItem.count();
  if (count > 0) return;

  await prisma.inventoryItem.createMany({
    data: [
      {
        name: "Wireless Barcode Scanner",
        sku: "SCAN-001",
        quantity: 24,
        category: "Electronics",
        status: StockStatus.in_stock,
        reorderLevel: 8,
        location: "Aisle A-2",
        supplier: "TechSource Ltd",
        notes: "Used at checkout counters.",
      },
      {
        name: "Packing Tape Roll",
        sku: "PACK-114",
        quantity: 6,
        category: "Warehouse Supplies",
        status: StockStatus.low_stock,
        reorderLevel: 10,
        location: "Aisle C-1",
        supplier: "Boxify Inc",
        notes: "Order in weekly batches.",
      },
      {
        name: "Thermal Label Printer",
        sku: "PRNT-220",
        quantity: 0,
        category: "Electronics",
        status: StockStatus.ordered,
        reorderLevel: 2,
        location: "Aisle A-1",
        supplier: "TechSource Ltd",
        notes: "Backordered by supplier.",
      },
    ],
  });
}

function validatePayload(body: Partial<ItemPayload>) {
  if (!body.name || !body.sku || !body.category) {
    throw new Error("Missing required fields");
  }

  if (!body.status || !(body.status in STATUS_TO_DB)) {
    throw new Error("Invalid status");
  }
}

export async function GET() {
  try {
    await ensureSeedData();
    const items = await prisma.inventoryItem.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(items.map(toClientItem));
  } catch {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ItemPayload>;
    validatePayload(body);

    const created = await prisma.inventoryItem.create({
      data: {
        name: body.name!.trim(),
        sku: body.sku!.trim(),
        quantity: Number(body.quantity ?? 0),
        category: body.category!.trim(),
        status: STATUS_TO_DB[body.status!],
        reorderLevel: Number(body.reorderLevel ?? 0),
        location: body.location?.trim() ?? "",
        supplier: body.supplier?.trim() ?? "",
        notes: body.notes?.trim() ?? "",
      },
    });

    return NextResponse.json(toClientItem(created), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "SKU already exists. Please use a unique SKU." },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Failed to create item";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
