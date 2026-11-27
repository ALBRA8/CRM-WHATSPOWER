import { withAuth } from "@/lib/api";
import * as http from "@/server/conversations/http/conversations";

export const dynamic = "force-dynamic";

export const GET = withAuth(http.GET);
