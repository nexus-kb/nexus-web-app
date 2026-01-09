import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/mailing-lists/enabled`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch mailing lists" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching mailing lists:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
