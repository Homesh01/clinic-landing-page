import type { MetaFunction } from "@remix-run/cloudflare";
import { Form, Link, useSearchParams } from "@remix-run/react";
import { useMemo, useState } from "react";
import { PageIntro } from "~/components/PageIntro";
import { booking, contact, site } from "~/data/content";

export const meta: MetaFunction = () => {
	return [
		{ title: `Book an appointment | ${site.name}` },
		{
			name: "description",
			content: booking.intro,
		},
	];
};

const SLOT_TIMES = ["09:30", "10:30", "12:00", "14:00", "15:30", "16:30"];

function buildAvailableDays(count = 14) {
	const days: { iso: string; label: string; weekday: string }[] = [];
	const cursor = new Date();
	cursor.setHours(12, 0, 0, 0);

	while (days.length < count) {
		cursor.setDate(cursor.getDate() + 1);
		const day = cursor.getDay();
		if (day === 0 || day === 6) continue;

		days.push({
			iso: cursor.toISOString().slice(0, 10),
			weekday: cursor.toLocaleDateString("en-GB", { weekday: "short" }),
			label: cursor.toLocaleDateString("en-GB", {
				day: "numeric",
				month: "short",
			}),
		});
	}

	return days;
}

export default function BookPage() {
	const days = useMemo(() => buildAvailableDays(), []);
	const [selectedDay, setSelectedDay] = useState(days[0]?.iso ?? "");
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [searchParams] = useSearchParams();
	const submitted = searchParams.get("submitted") === "1";

	return (
		<>
			<PageIntro
				eyebrow="Book an appointment"
				title="Choose a time that works for you"
				summary={booking.intro}
			/>

			<section className="section-pad">
				<div className="site-container grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
					<div>
						{submitted ? (
							<div className="border border-accent/25 bg-accent-soft px-6 py-8">
								<p className="eyebrow">Request received</p>
								<h2 className="mt-3 font-display text-3xl text-ink">
									Thank you — we will confirm shortly
								</h2>
								<p className="mt-3 text-ink-soft">
									This is a placeholder confirmation. Connect a live booking
									system when ready; meanwhile the practice team will follow up
									using the details you provided.
								</p>
								<Link to="/book" className="link-underline mt-6">
									Make another request
									<span aria-hidden="true">→</span>
								</Link>
							</div>
						) : (
							<>
								<p className="text-sm text-ink-muted">{booking.note}</p>

								<div className="mt-8">
									<p className="eyebrow">Available dates</p>
									<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
										{days.map((day) => {
											const active = day.iso === selectedDay;
											return (
												<button
													key={day.iso}
													type="button"
													onClick={() => {
														setSelectedDay(day.iso);
														setSelectedSlot(null);
													}}
													className={`rounded-sm border px-3 py-3 text-left transition ${
														active
															? "border-accent bg-accent text-white"
															: "border-line bg-white hover:border-accent/40"
													}`}
												>
													<span className="block text-xs uppercase tracking-wide opacity-80">
														{day.weekday}
													</span>
													<span className="mt-1 block text-sm font-semibold">
														{day.label}
													</span>
												</button>
											);
										})}
									</div>
								</div>

								<div className="mt-10">
									<p className="eyebrow">Available times</p>
									<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
										{SLOT_TIMES.map((time) => {
											const active = selectedSlot === time;
											return (
												<button
													key={time}
													type="button"
													onClick={() => setSelectedSlot(time)}
													className={`rounded-sm border px-4 py-3 text-sm font-semibold transition ${
														active
															? "border-accent bg-accent-soft text-accent-deep"
															: "border-line bg-white text-ink hover:border-accent/40"
													}`}
												>
													{time}
												</button>
											);
										})}
									</div>
								</div>

								<Form method="get" className="mt-10 space-y-5 border-t border-line pt-10">
									<input type="hidden" name="submitted" value="1" />
									<input type="hidden" name="date" value={selectedDay} />
									<input type="hidden" name="time" value={selectedSlot ?? ""} />

									<div className="grid gap-5 sm:grid-cols-2">
										<label className="block">
											<span className="mb-2 block text-sm font-semibold text-ink">
												Full name
											</span>
											<input
												required
												name="name"
												className="w-full rounded-sm border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
												placeholder="Your name"
											/>
										</label>
										<label className="block">
											<span className="mb-2 block text-sm font-semibold text-ink">
												Email
											</span>
											<input
												required
												type="email"
												name="email"
												className="w-full rounded-sm border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
												placeholder="you@example.com"
											/>
										</label>
									</div>

									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-ink">
											Phone
										</span>
										<input
											required
											name="phone"
											className="w-full rounded-sm border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
											placeholder="Contact number"
										/>
									</label>

									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-ink">
											Consultation type
										</span>
										<select
											name="type"
											className="w-full rounded-sm border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
											defaultValue="New Patient Consultation"
										>
											<option>New Patient Consultation</option>
											<option>Second Opinion</option>
											<option>Follow-up / Monitoring</option>
											<option>Virtual Consultation</option>
										</select>
									</label>

									<label className="block">
										<span className="mb-2 block text-sm font-semibold text-ink">
											Notes (optional)
										</span>
										<textarea
											name="notes"
											rows={4}
											className="w-full rounded-sm border border-line bg-white px-4 py-3 outline-none transition focus:border-accent"
											placeholder="Brief context for the appointment"
										/>
									</label>

									<button
										type="submit"
										className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
										disabled={!selectedDay || !selectedSlot}
									>
										Request appointment
										{selectedSlot ? ` · ${selectedSlot}` : ""}
									</button>
								</Form>
							</>
						)}
					</div>

					<aside className="h-fit border border-line bg-cream/70 p-7 sm:p-8">
						<p className="eyebrow">Prefer to speak with someone?</p>
						<h2 className="mt-3 font-display text-3xl text-ink">
							Contact the practice team
						</h2>
						<p className="mt-4 text-ink-soft">
							If you would rather book by phone or email, the secretary can help
							arrange a suitable appointment.
						</p>
						<ul className="mt-6 space-y-3 text-ink-soft">
							<li>
								<span className="block text-sm text-ink-muted">
									{contact.secretaryLabel}
								</span>
								{contact.name}
							</li>
							<li>
								<a
									href={`mailto:${contact.email}`}
									className="transition-colors hover:text-accent"
								>
									{contact.email}
								</a>
							</li>
							<li>{contact.phone}</li>
						</ul>
						<Link to="/contact" className="link-underline mt-8">
							View locations &amp; fees
							<span aria-hidden="true">→</span>
						</Link>
					</aside>
				</div>
			</section>
		</>
	);
}
