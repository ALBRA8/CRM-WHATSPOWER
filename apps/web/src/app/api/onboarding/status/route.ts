import { withAuth } from "@/lib/api";
import * as http from "@/server/organizations/http/onboarding-status";

export const dynamic = "force-dynamic";

export const GET = withAuth(http.GET);
