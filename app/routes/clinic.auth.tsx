import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";
import {
	createClinicStaffSessionHeaders,
	verifyClinicMagicLinkToken,
} from "~/utils/clinic-auth.server";
import { requireSiteAccess } from "~/utils/site-auth.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireSiteAccess(request, context.cloudflare.env);
	const url = new URL(request.url);
	const token = url.searchParams.get("token")?.trim() ?? "";
	const verified = await verifyClinicMagicLinkToken(
		context.cloudflare.env,
		token,
	);

	if (!verified) {
		throw redirect("/clinic?auth=expired");
	}

	const headers = await createClinicStaffSessionHeaders(
		request,
		context.cloudflare.env,
		verified.email,
	);
	throw redirect("/clinic?auth=ok", { headers });
}
