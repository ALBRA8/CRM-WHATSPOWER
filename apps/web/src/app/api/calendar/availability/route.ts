import { withAuth } from "@/lib/api";
import * as http from "@/server/scheduling/http/calendar-availability";

export const dynamic = "force-dynamic";

export const GET = withAuth(http.GET);
