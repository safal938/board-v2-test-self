import { NextResponse } from "next/server";

const BASE_URL = "https://board-v25.vercel.app";

export async function POST() {
  try {
    // Fetch all board items
    const response = await fetch(`${BASE_URL}/api/board-items`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch board items" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Filter items to delete (exclude 'raw' and 'single-encounter' items)
    const itemsToDelete = data.filter((item) => {
      const id = item.id || "";
      return !id.includes("raw") && !id.includes("single-encounter");
    });

    // Delete filtered items
    const deletePromises = itemsToDelete
      .filter((item) => {
        const id = item.id;
        return (
          id.startsWith("enhanced") ||
          id.startsWith("item") ||
          id.startsWith("doctor-note")
        );
      })
      .map(async (item) => {
        const deleteResponse = await fetch(
          `${BASE_URL}/api/board-items/${item.id}`,
          { method: "DELETE" }
        );
        return {
          id: item.id,
          status: deleteResponse.status,
          result: await deleteResponse.json(),
        };
      });

    const results = await Promise.all(deletePromises);

    return NextResponse.json({
      success: true,
      deletedCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Error clearing board:", error);
    return NextResponse.json(
      { error: "Failed to clear board items" },
      { status: 500 }
    );
  }
}
