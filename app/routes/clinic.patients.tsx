import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Outlet } from "@remix-run/react";
import { requireClinicStaff } from "~/utils/clinic-staff.server";

/** Layout gate for /clinic/patients/* — auth only; UI lives in child routes. */
export async function loader({ request, context }: LoaderFunctionArgs) {
	await requireClinicStaff(request, context.cloudflare.env);
	return null;
}

export default function ClinicPatientsLayout() {
	return <Outlet />;
}
