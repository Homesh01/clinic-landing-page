import { NavLink } from "@remix-run/react";
import { useEffect, useState } from "react";
import { nav } from "~/data/content";

const BRAND = "Personalised Cancer Care";

export function Header() {
	const [open, setOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	const close = () => setOpen(false);

	const linkClass = ({ isActive }: { isActive: boolean }) =>
		`text-[1.05rem] tracking-wide transition-colors ${
			isActive
				? "font-semibold text-accent"
				: "text-ink-soft hover:text-accent"
		}`;

	return (
		<header
			className={`sticky top-0 z-50 border-b transition-colors duration-300 ${
				scrolled || open
					? "border-line bg-white/95 backdrop-blur-md"
					: "border-transparent bg-white/70 backdrop-blur-sm"
			}`}
		>
			<div className="mx-auto flex w-full max-w-[100rem] items-center gap-4 px-3 py-1.5 sm:px-4 lg:px-5 lg:py-2">
				<div className="flex min-w-0 flex-1 items-center">
					<NavLink
						to="/"
						className="group inline-flex min-w-0 items-center leading-none"
						onClick={close}
						aria-label={BRAND}
					>
						{/* Compact monogram on the smallest screens */}
						<img
							src="/logo-mark.png"
							alt=""
							width={160}
							height={111}
							className="h-12 w-auto transition-opacity group-hover:opacity-90 sm:hidden"
							decoding="async"
						/>
						{/* Full lockup from sm up */}
						<img
							src="/main-logo-1.png"
							alt=""
							width={320}
							height={120}
							className="hidden h-[3.75rem] w-auto max-w-[min(100%,22rem)] transition-opacity group-hover:opacity-90 sm:block lg:h-[4.25rem] lg:max-w-[25rem]"
							decoding="async"
						/>
					</NavLink>
				</div>

				<nav
					className="hidden shrink-0 items-center gap-4 lg:flex xl:gap-5 2xl:gap-7"
					aria-label="Primary"
				>
					{nav.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							className={linkClass}
							onClick={close}
						>
							{item.label}
						</NavLink>
					))}
				</nav>

				<div className="flex flex-1 items-center justify-end gap-3">
					<NavLink
						to="/book"
						className="btn-primary hidden !px-4 !py-2.5 text-[1.05rem] whitespace-nowrap lg:inline-flex"
					>
						Book a consultation
					</NavLink>

					<button
						type="button"
						className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line text-ink lg:hidden"
						aria-expanded={open}
						aria-controls="mobile-nav"
						aria-label={open ? "Close menu" : "Open menu"}
						onClick={() => setOpen((value) => !value)}
					>
						<span className="sr-only">Menu</span>
						<div className="flex w-5 flex-col gap-1.5">
							<span
								className={`h-px w-full bg-current transition ${
									open ? "translate-y-[3.5px] rotate-45" : ""
								}`}
							/>
							<span
								className={`h-px w-full bg-current transition ${
									open ? "opacity-0" : ""
								}`}
							/>
							<span
								className={`h-px w-full bg-current transition ${
									open ? "-translate-y-[3.5px] -rotate-45" : ""
								}`}
							/>
						</div>
					</button>
				</div>
			</div>

			<div
				id="mobile-nav"
				className={`border-t border-line bg-white lg:hidden ${
					open ? "block" : "hidden"
				}`}
			>
				<nav
					className="mx-auto flex w-full max-w-[100rem] flex-col gap-1 px-3 py-4 sm:px-4 lg:px-5"
					aria-label="Mobile"
				>
					{nav.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							onClick={close}
							className={({ isActive }) =>
								`rounded-sm px-3 py-3 text-[1.1rem] ${
									isActive
										? "bg-accent-soft font-semibold text-accent"
										: "text-ink-soft"
								}`
							}
						>
							{item.label}
						</NavLink>
					))}
					<NavLink
						to="/book"
						onClick={close}
						className="btn-primary mt-2 justify-center"
					>
						Book a consultation
					</NavLink>
				</nav>
			</div>
		</header>
	);
}
