import { redirect } from "next/navigation";
import { resolveDefaultThreadDestination } from "@/lib/api/server-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const destination = await resolveDefaultThreadDestination();
  redirect(destination);
}
