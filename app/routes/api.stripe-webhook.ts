import type { ActionFunctionArgs } from "@remix-run/cloudflare";
import {
	fulfillPaidCheckoutSession,
	getStripeConfig,
	parseStripeWebhookEvent,
	retrieveCheckoutSession,
	verifyStripeWebhookSignature,
} from "~/utils/stripe.server";

export async function action({ request, context }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return new Response("Method not allowed", { status: 405 });
	}

	const stripe = getStripeConfig(context.cloudflare.env);
	if (!stripe?.webhookSecret) {
		console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set");
		return new Response("Webhook not configured", { status: 503 });
	}

	const payload = await request.text();
	const signatureHeader = request.headers.get("stripe-signature");
	const valid = await verifyStripeWebhookSignature({
		payload,
		signatureHeader,
		webhookSecret: stripe.webhookSecret,
	});

	if (!valid) {
		return new Response("Invalid signature", { status: 400 });
	}

	const event = await parseStripeWebhookEvent(payload);

	if (event.type === "checkout.session.completed") {
		const session =
			event.data.object.id && event.data.object.payment_status
				? event.data.object
				: await retrieveCheckoutSession(stripe, event.data.object.id);

		const result = await fulfillPaidCheckoutSession({
			env: context.cloudflare.env,
			stripe,
			session,
		});

		if (!result.ok) {
			console.error("Stripe webhook fulfillment failed:", result.error);
			// 200 so Stripe does not endlessly retry for business conflicts;
			// payment was taken and needs manual follow-up if booking failed.
		}
	}

	return new Response(JSON.stringify({ received: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

export async function loader() {
	return new Response("Not found", { status: 404 });
}
