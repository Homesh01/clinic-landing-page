import { contact, faqPage, locations, site } from "~/data/content";

export const SITE_ORIGIN = "https://personalisedcancercare.com";
export const CLINIC_BRAND = "Personalised Cancer Care";
export const CLINIC_TAGLINE =
	"Private consultant oncology care in London for thyroid cancer and haematological malignancies — personalised treatment planning informed by clinical expertise and translational AI.";
export const DEFAULT_OG_IMAGE = "/main-logo-1.png";

const PUBLIC_PATHS = [
	"/",
	"/about",
	"/conditions",
	"/consultations",
	"/conferences",
	"/blog",
	"/faq",
	"/contact",
	"/book",
] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function getPublicPaths(): readonly PublicPath[] {
	return PUBLIC_PATHS;
}

/** Browser tab / OG title: clinic brand is primary. */
export function clinicPageTitle(section?: string): string {
	if (!section) {
		return `${CLINIC_BRAND} | Consultant oncology care`;
	}
	return `${section} | ${CLINIC_BRAND}`;
}

export function absoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const normalised = path.startsWith("/") ? path : `/${path}`;
	return `${SITE_ORIGIN}${normalised}`;
}

function truncateMeta(value: string, max = 160): string {
	const cleaned = value.replace(/\s+/g, " ").trim();
	if (cleaned.length <= max) return cleaned;
	const slice = cleaned.slice(0, max - 1);
	const lastSpace = slice.lastIndexOf(" ");
	return `${(lastSpace > 80 ? slice.slice(0, lastSpace) : slice).trimEnd()}…`;
}

export type PageMetaInput = {
	title: string;
	description: string;
	path: string;
	image?: string;
	imageAlt?: string;
	noIndex?: boolean;
	ogType?: "website" | "article" | "profile";
};

/** Remix `meta` entries: title, description, canonical, Open Graph, Twitter. */
export function buildPageMeta(input: PageMetaInput) {
	const title = input.title;
	const description = truncateMeta(input.description);
	const canonical = absoluteUrl(input.path === "/" ? "/" : input.path);
	const image = absoluteUrl(input.image ?? DEFAULT_OG_IMAGE);
	const imageAlt = input.imageAlt ?? CLINIC_BRAND;
	const ogType = input.ogType ?? "website";

	const robots = input.noIndex
		? "noindex, nofollow"
		: "index, follow, max-image-preview:large";

	return [
		{ title },
		{ name: "description", content: description },
		{ name: "robots", content: robots },
		{ name: "author", content: CLINIC_BRAND },
		{ name: "theme-color", content: "#1F6F6A" },
		{ tagName: "link", rel: "canonical", href: canonical },
		{ property: "og:site_name", content: CLINIC_BRAND },
		{ property: "og:locale", content: "en_GB" },
		{ property: "og:type", content: ogType },
		{ property: "og:title", content: title },
		{ property: "og:description", content: description },
		{ property: "og:url", content: canonical },
		{ property: "og:image", content: image },
		{ property: "og:image:alt", content: imageAlt },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: image },
		{ name: "twitter:image:alt", content: imageAlt },
	];
}

/** Primary entity: the clinic. Consultant listed as employee. */
export function clinicJsonLd() {
	const primary = locations[0];
	return {
		"@context": "https://schema.org",
		"@type": ["MedicalBusiness", "MedicalClinic"],
		"@id": `${SITE_ORIGIN}/#clinic`,
		name: CLINIC_BRAND,
		url: SITE_ORIGIN,
		logo: absoluteUrl(DEFAULT_OG_IMAGE),
		image: absoluteUrl(DEFAULT_OG_IMAGE),
		email: contact.email,
		description: CLINIC_TAGLINE,
		medicalSpecialty: [
			"Oncology",
			"Clinical Oncology",
			"Thyroid cancer",
			"Haematological malignancies",
			"Radiotherapy",
		],
		areaServed: {
			"@type": "Country",
			name: "United Kingdom",
		},
		address: {
			"@type": "PostalAddress",
			streetAddress: primary.addressLines.slice(0, -1).join(", "),
			addressLocality: "London",
			postalCode: "WC1E 6AG",
			addressCountry: "GB",
		},
		location: locations.map((loc) => ({
			"@type": "MedicalClinic",
			name: loc.name,
			url: loc.mapsUrl,
			address: {
				"@type": "PostalAddress",
				streetAddress: loc.addressLines.join(", "),
				addressLocality: "London",
				addressCountry: "GB",
			},
		})),
		contactPoint: {
			"@type": "ContactPoint",
			contactType: "patient enquiries",
			email: contact.email,
			availableLanguage: ["English"],
		},
		employee: {
			"@type": "Physician",
			"@id": `${SITE_ORIGIN}/#physician`,
			name: site.name,
			jobTitle: site.title,
			url: absoluteUrl("/about"),
			image: absoluteUrl(site.headshot),
			identifier: {
				"@type": "PropertyValue",
				name: "GMC Registration Number",
				value: site.gmc,
				url: site.gmcVerifyUrl,
			},
		},
	};
}

export function websiteJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": `${SITE_ORIGIN}/#website`,
		name: CLINIC_BRAND,
		url: SITE_ORIGIN,
		description: CLINIC_TAGLINE,
		publisher: { "@id": `${SITE_ORIGIN}/#clinic` },
		inLanguage: "en-GB",
	};
}

export function faqPageJsonLd() {
	const entities = faqPage.groups.flatMap((group) =>
		group.items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	);

	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: entities,
		isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
		about: { "@id": `${SITE_ORIGIN}/#clinic` },
	};
}

export function breadcrumbJsonLd(
	crumbs: readonly { name: string; path: string }[],
) {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: crumbs.map((crumb, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: crumb.name,
			item: absoluteUrl(crumb.path),
		})),
	};
}
