import { redirect } from "@remix-run/cloudflare";
import {
	getClinicStaffSession,
	type ClinicStaffSession,
} from "~/utils/clinic-auth.server";
import { requireSiteAccess } from "~/utils/site-auth.server";

/** Site gate + staff session. Redirects unsigned staff to the clinic hub. */
export async function requireClinicStaff(
	request: Request,
	env: Env | undefined,
): Promise<ClinicStaffSession> {
	await requireSiteAccess(request, env);
	const staff = await getClinicStaffSession(request, env);
	if (!staff) {
		throw redirect("/clinic");
	}
	return staff;
}
