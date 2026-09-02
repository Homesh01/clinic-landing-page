import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/cloudflare";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { json, redirect } from "@remix-run/cloudflare";
import { site } from "~/data/content";
import {
	createSiteAccessHeaders,
	getSitePassword,
	hasSiteAccess,
} from "~/utils/site-auth.server";

export const meta: MetaFunction = () => {
	return [{ title: `Private access | ${site.name}` }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
	const password = getSitePassword(context.cloudflare.env);
	if (!password) {
		throw redirect("/");
	}

	if (await hasSiteAccess(request, password)) {
		const url = new URL(request.url);
		const redirectTo = url.searchParams.get("redirectTo") || "/";
		throw redirect(safeRedirectTo(redirectTo));
	}

	return json(null);
}

export async function action({ request, context }: ActionFunctionArgs) {
	const password = getSitePassword(context.cloudflare.env);
	if (!password) {
		throw redirect("/");
	}

	const formData = await request.formData();
	const submitted = String(formData.get("password") ?? "");
	const redirectTo = safeRedirectTo(String(formData.get("redirectTo") ?? "/"));

	if (submitted !== password) {
		return json({ error: "Incorrect password. Please try again." }, { status: 401 });
	}

	return redirect(redirectTo, {
		headers: await createSiteAccessHeaders(request, password),
	});
}

function safeRedirectTo(value: string) {
	if (!value.startsWith("/") || value.startsWith("//")) return "/";
	return value;
}

export default function LoginPage() {
	const actionData = useActionData<typeof action>();
	const [searchParams] = useSearchParams();
	const redirectTo = searchParams.get("redirectTo") || "/";

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-mist to-white px-5 py-16">
			<div className="w-full max-w-md">
				<p className="font-display text-2xl text-ink">{site.name}</p>
				<p className="mt-2 text-sm uppercase tracking-[0.16em] text-ink-muted">
					{site.title}
				</p>
				<p className="eyebrow mt-8">Private preview</p>
				<p className="mt-4 text-ink-soft">
					This site is password protected while content is being finalised.
					Enter the access password to continue.
				</p>

				<Form method="post" className="mt-8 space-y-5">
					<input type="hidden" name="redirectTo" value={redirectTo} />
					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-ink">
							Password
						</span>
						<input
							type="password"
							name="password"
							required
							autoFocus
							autoComplete="current-password"
							className="input-field"
						/>
					</label>

					{actionData?.error ? (
						<p className="text-sm font-medium text-red-700" role="alert">
							{actionData.error}
						</p>
					) : null}

					<button type="submit" className="btn-primary w-full justify-center">
						Enter site
					</button>
				</Form>
			</div>
		</div>
	);
}
