import { Outlet } from "@remix-run/react";

/** Parent layout for /clinic/* so child routes render correctly. */
export default function ClinicLayout() {
	return <Outlet />;
}
