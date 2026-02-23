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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<ItemPayload>;

    if (!body.name || !body.sku || !body.category || !body.status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        name: body.name.trim(),
        sku: body.sku.trim(),
        quantity: Number(body.quantity ?? 0),
        category: body.category.trim(),
        status: STATUS_TO_DB[body.status],
        reorderLevel: Number(body.reorderLevel ?? 0),
        location: body.location?.trim() ?? "",
        supplier: body.supplier?.trim() ?? "",
        notes: body.notes?.trim() ?? "",
      },
    });

    return NextResponse.json(toClientItem(updated));
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

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to update item" }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await prisma.inventoryItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to delete item" }, { status: 400 });
  }
}
