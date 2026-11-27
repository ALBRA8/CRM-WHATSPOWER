import { withAuth } from "@/lib/api";
import * as http from "@/server/agents/http/agent-preset";

export const dynamic = "force-dynamic";

export const POST = withAuth(http.POST);
