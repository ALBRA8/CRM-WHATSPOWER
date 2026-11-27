import { withAuth } from "@/lib/api";
import * as http from "@/server/agents/http/agent-brain-status";

export const dynamic = "force-dynamic";

export const GET = withAuth(http.GET);
