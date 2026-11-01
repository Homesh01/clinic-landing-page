import { Outlet } from "@remix-run/react";

/** Parent layout for /admin/* so child routes render correctly. */
export default function AdminLayout() {
	return <Outlet />;
}
