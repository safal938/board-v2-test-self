// Session-Aware Board Reset Script
// This can be used as a standalone script or adapted for Next.js API route

const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";

/**
 * Reset board for a specific session
 * @param {string} sessionId - The session ID to reset
 * @returns {Promise<Object>} Result of the reset operation
 */
async function resetBoardForSession(sessionId) {
  try {
    console.log(`🔄 Resetting board for session: ${sessionId}`);

    // Fetch all board items for this session
    const response = await fetch(
      `${BASE_URL}/api/board-items?sessionId=${sessionId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch board items: ${response.status}`);
    }

    const responseData = await response.json();
    const data = responseData.items || responseData; // Handle both formats

    console.log(`📊 Found ${data.length} total items`);

    // Filter items to delete (exclude 'raw' and 'single-encounter' items)
    const itemsToDelete = data.filter((item) => {
      const id = item.id || "";
      return !id.includes("raw") && !id.includes("single-encounter");
    });

    console.log(
      `📋 After first filter: ${itemsToDelete.length} items (excluded raw/single-encounter)`
    );

    // Further filter to only delete specific item types
    const itemsToActuallyDelete = itemsToDelete.filter((item) => {
      const id = item.id;
      return (
        id.startsWith("enhanced") ||
        id.startsWith("item") ||
        id.startsWith("doctor-note")
      );
    });

    console.log(`🗑️ Deleting ${itemsToActuallyDelete.length} items...`);

    // Delete filtered items (session-aware)
    const deletePromises = itemsToActuallyDelete.map(async (item) => {
      try {
        const deleteResponse = await fetch(
          `${BASE_URL}/api/board-items/${item.id}?sessionId=${sessionId}`,
          {
            method: "DELETE",
            headers: {
              "X-Session-Id": sessionId,
              "Content-Type": "application/json",
            },
          }
        );

        const result = await deleteResponse.json();

        return {
          id: item.id,
          status: deleteResponse.status,
          success: deleteResponse.ok,
          result,
        };
      } catch (error) {
        console.error(`❌ Failed to delete ${item.id}:`, error);
        return {
          id: item.id,
          status: 500,
          success: false,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(deletePromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(
      `✅ Reset complete: ${successCount} deleted, ${failCount} failed`
    );

    return {
      success: true,
      sessionId,
      deletedCount: successCount,
      failedCount: failCount,
      results,
    };
  } catch (error) {
    console.error("❌ Error resetting board:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// For Next.js API Route (app/api/board-reset/route.ts)
// export async function POST(request) {
//   try {
//     const { sessionId } = await request.json();
//
//     if (!sessionId) {
//       return NextResponse.json(
//         { error: "Session ID is required" },
//         { status: 400 }
//       );
//     }
//
//     const result = await resetBoardForSession(sessionId);
//
//     if (result.success) {
//       return NextResponse.json(result);
//     } else {
//       return NextResponse.json(
//         { error: result.error },
//         { status: 500 }
//       );
//     }
//   } catch (error) {
//     console.error("Error in board reset API:", error);
//     return NextResponse.json(
//       { error: "Failed to reset board" },
//       { status: 500 }
//     );
//   }
// }

// For standalone script usage
if (require.main === module) {
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.error("❌ Usage: node board-reset.js <sessionId>");
    process.exit(1);
  }

  resetBoardForSession(sessionId)
    .then((result) => {
      console.log("\n📊 Final Result:");
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { resetBoardForSession };
