export const site = {
	name: "Dr Karen Sayal",
	title: "Consultant Clinical Oncologist",
	tagline:
		"Personalised cancer care for thyroid malignancies and radiotherapy for haematological cancers — informed by clinical expertise and translational AI.",
	gmc: "7140353",
	gmcVerifyUrl:
		"https://www.gmc-uk.org/concerns-information/gmc-online-doctor-search",
	headshot: "/karen_sayal_image.jpeg",
};

export const nav = [
	{ to: "/about", label: "About" },
	{ to: "/conditions", label: "Conditions" },
	{ to: "/consultations", label: "Consultations" },
	{ to: "/conferences", label: "Conferences" },
	{ to: "/blog", label: "Blog" },
	{ to: "/#faq", label: "FAQ", hash: true },
	{ to: "/contact", label: "Contact" },
] as const;

export const credentials = [
	{
		abbr: "MB BChir (Cantab)",
		detail: "Gonville and Caius College, University of Cambridge",
	},
	{
		abbr: "MRCP",
		detail: "Member of the Royal College of Physicians",
	},
	{
		abbr: "FRCR",
		detail: "Fellow of the Royal College of Radiologists",
	},
	{
		abbr: "DPhil (Oxon)",
		detail:
			"University of Oxford / Oxford CRUK Cancer Centre; CRUK Clinical Research Training Fellowship",
	},
	{
		abbr: "GMC",
		detail: `Registration No. ${site.gmc}`,
		verifyUrl: site.gmcVerifyUrl,
	},
] as const;

export const appointments = [
	{
		role: "Consultant Clinical Oncologist & Translational AI Innovation Lead — UCLH",
		period: "current",
	},
	{
		role: "Formerly: Senior Director, AI Industrialised Clinical Development — Recursion Pharmaceuticals",
		period: "years to add",
	},
	{
		role: "Formerly: Postdoctoral Fellow, AI Division — GSK Pharmaceuticals",
		period: "years to add",
	},
] as const;

export const about = {
	heroTitle: "A clinician at the intersection of oncology and AI",
	heroLede:
		"Dr Karen Sayal is a Consultant Clinical Oncologist specialising in thyroid cancer and radiotherapy for haematological cancers. She combines specialist clinical training with a research and industry background in artificial intelligence — experience she draws on to help design treatment plans that are precise, well-informed, and built around each patient.",
	sections: [
		{
			heading: "Where she practises",
			paragraphs: [
				"Dr Sayal sees patients at UCLH (HCA Healthcare), The London Oncology Clinic (HCA Healthcare), and on Harley Street. She holds an NHS Consultant post at University College London Hospitals NHS Foundation Trust (UCLH), where she is also Translational AI Innovation Lead, leading the development of AI-driven tools for personalised therapy, streamlined care delivery, and expanding the range of treatments available to patients.",
			],
		},
		{
			heading: "Clinical training & research",
			paragraphs: [
				"Dr Sayal read medicine at Gonville and Caius College, University of Cambridge (MB BChir Cantab) and trained as a clinician (MRCP) before specialising in Clinical Oncology, gaining her Fellowship of the Royal College of Radiologists (FRCR). She was the first NIHR-funded Academic Clinical Trainee in Clinical Oncology at the University of Oxford, and went on to complete a DPhil (Oxon) as a Cancer Research UK Clinical Research Training Fellow at the Oxford CRUK Cancer Centre.",
				"Her doctoral research examined the tumour microenvironment in triple-negative breast cancer using spatial transcriptomics and single-cell sequencing — techniques that map how individual cells within a tumour behave, and how they respond to treatment — including a research collaboration with the Broad Institute of MIT and Harvard.",
			],
		},
		{
			heading: "From research to industry AI",
			paragraphs: [
				"It was during her doctoral research that Dr Sayal taught herself linear algebra and statistical inference — the mathematical foundations of machine learning — a decision that shaped the next stage of her career. After her DPhil, she completed a postdoctoral fellowship in the AI division of GSK Pharmaceuticals, before being appointed Senior Director in AI Industrialised Clinical Development at Recursion Pharmaceuticals, a leading AI-driven drug discovery company, where she led work applying artificial intelligence to accelerate and de-risk clinical development at scale.",
			],
		},
		{
			heading: "Bringing it together",
			paragraphs: [
				"Dr Sayal brings that experience directly into the care of her own patients. Because she is personally involved in developing and testing new AI-driven technologies at UCLH, she can draw on first-hand knowledge of which emerging tools and treatments are genuinely ready to help — not simply what is already established practice — when she reviews a patient's scans, pathology and options. She continues to see and treat patients with thyroid cancer and haematological malignancies requiring radiotherapy throughout, with every treatment plan still built around the individual in front of her.",
			],
		},
	],
	belief:
		"Technology and clinical expertise should work together to give every patient a treatment plan that is accurate, timely, and genuinely personal to them.",
	bottomCta:
		"New patient reviews, second opinions, and ongoing monitoring appointments are available across UCLH, The London Oncology Clinic, and Harley Street.",
};

export const conditions = [
	{
		slug: "thyroid-cancer",
		title: "Thyroid Cancer",
		summary:
			"Expert diagnosis, treatment planning and ongoing care for patients with thyroid cancer.",
		body: "Dr Sayal provides expert diagnosis, treatment planning and ongoing care for patients with thyroid cancer, including differentiated (papillary and follicular), medullary and anaplastic subtypes. This includes staging, radioactive iodine therapy planning, external beam radiotherapy where indicated, and systemic treatment, delivered in close collaboration with endocrine surgeons and specialist nurses.",
	},
	{
		slug: "haematological-cancers",
		title: "Radiotherapy for Haematological Cancers",
		summary:
			"Radiotherapy planning and delivery for lymphoma, leukaemia and myeloma.",
		body: "Dr Sayal offers radiotherapy planning and delivery for patients with haematological malignancies, including lymphoma, leukaemia and myeloma, working alongside haematologists as part of a multidisciplinary team to integrate radiotherapy with systemic treatment.",
	},
] as const;

export const services = [
	{
		title: "New Patient Consultation",
		description:
			"Review of scans and pathology, discussion of options, and a written treatment plan.",
	},
	{
		title: "Second Opinion",
		description:
			"An independent review of diagnosis and proposed treatment.",
	},
	{
		title: "Radiotherapy Planning & Delivery",
		description:
			"For thyroid cancer and haematological malignancies.",
	},
	{
		title: "Ongoing Treatment & Monitoring",
		description:
			"Regular review appointments during and after treatment.",
	},
	{
		title: "Virtual Consultations",
		description:
			"Video appointments for patients unable to attend in person.",
	},
] as const;

export const conferences = [
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
	{
		title: "Conference presentation — placeholder",
		detail:
			"Title, meeting name, location and date to be confirmed.",
	},
] as const;

export const publications = [
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
	{
		title: "Publication — placeholder",
		detail: "Citation details to be confirmed.",
	},
] as const;

export const blog = {
	intro:
		"Selected commentary and posts from Dr Sayal on oncology, translational AI, and developments in cancer care.",
	social: [
		{
			platform: "LinkedIn",
			label: "Follow on LinkedIn",
			url: "https://www.linkedin.com/",
			description:
				"Professional updates, conference reflections, and perspectives on oncology and AI in medicine.",
		},
		{
			platform: "X",
			label: "Follow on X",
			url: "https://x.com/",
			description:
				"Shorter posts and links to talks, publications, and clinical innovation.",
		},
	],
	note: "Profile URLs to be confirmed — replace the placeholder links when ready.",
} as const;

export const fees = {
	intro:
		"Dr Sayal accepts patients funded through private medical insurance as well as self-funding patients. Fees are discussed and confirmed prior to your first appointment.",
	insurers: "Insurers accepted — to be confirmed.",
	selfPay: "Self-pay indicative fee — to be confirmed.",
};

export const locations = [
	{
		name: "UCLH (HCA Healthcare)",
		address: "Exact address to be confirmed.",
	},
	{
		name: "The London Oncology Clinic (LOC), HCA Healthcare",
		address: "Exact address to be confirmed.",
	},
	{
		name: "Harley Street",
		address: "Practice name and address to be confirmed.",
	},
] as const;

export const contact = {
	secretaryLabel: "Secretary / PA",
	name: "Name to be confirmed",
	email: "email@to-be-confirmed.example",
	phone: "Phone to be confirmed",
};

export const booking = {
	intro:
		"Booking an appointment with Dr Sayal is simple — use the calendar below to view available slots and book a consultation online, or contact the secretary directly.",
	note: "Online booking calendar placeholder — connect your preferred booking platform (e.g. Calendly, Cliniko, or HCA booking) when ready.",
};

export const faqs = [
	{
		question: "What conditions does Dr Sayal treat?",
		answer:
			"Dr Sayal specialises in thyroid cancer and radiotherapy for haematological malignancies, including lymphoma, leukaemia and myeloma. Care is delivered as part of a multidisciplinary team.",
	},
	{
		question: "Do I need a referral to book a consultation?",
		answer:
			"A GP or specialist referral is often helpful, but second-opinion and private consultations can usually be arranged directly. The practice team can advise on what is needed before your appointment.",
	},
	{
		question: "Where are clinics held?",
		answer:
			"Dr Sayal sees patients at UCLH (HCA Healthcare), The London Oncology Clinic (HCA Healthcare), and on Harley Street. Virtual consultations are also available where appropriate.",
	},
	{
		question: "What happens at a first consultation?",
		answer:
			"Your first appointment typically includes a review of scans and pathology, discussion of diagnosis and options, and a clear written treatment plan so you know the recommended next steps.",
	},
	{
		question: "Is private medical insurance accepted?",
		answer:
			"Yes. Dr Sayal accepts patients funded through private medical insurance as well as self-funding patients. Fees and insurer details are confirmed before your first appointment.",
	},
	{
		question: "Can I request a second opinion?",
		answer:
			"Yes. Second-opinion consultations provide an independent review of diagnosis and proposed treatment, which can help you feel confident about the pathway ahead.",
	},
] as const;
