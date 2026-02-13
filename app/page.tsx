import { redirect } from "next/navigation";
import { resolveDefaultThreadDestination } from "@/lib/api/server-data";

export default async function Home() {
  const destination = await resolveDefaultThreadDestination();
  redirect(destination);
}
