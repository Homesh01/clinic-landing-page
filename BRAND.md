# Personalised Cancer Care — Brand style guide

Source of truth for visual and verbal identity across the website, emails, and print. Derived from the live site at [personalisedcancercare.com](https://personalisedcancercare.com).

---

## 1. Brand summary

**Personalised Cancer Care** is the patient-facing practice brand for **Dr Karen Sayal**, Consultant Clinical Oncologist. The work sits at the intersection of specialist oncology (thyroid cancer; radiotherapy for haematological cancers) and carefully applied clinical AI/research experience. The brand should feel calm, precise, and clinically credible — like a trusted London consultant, not a wellness spa or a tech startup.

---

## 2. Brand architecture

| Layer | Name | Role |
| --- | --- | --- |
| Clinician | Dr Karen Sayal | Hero-level identity on the website; expertise and trust |
| Practice / bookings | Personalised Cancer Care | Clinic operations, emails, booking references |
| Strapline | Consultant oncology care | Small uppercase supporting line under the wordmark |

- On branded surfaces, the clinician or practice name must be a **hero-level** signal — not only nav text.
- Prefer British English (`organisation`, `authorisation`, UK date phrasing).

---

## 3. Voice & writing

**Tone:** calm, precise, human, reassuring. Never alarmist or promotional.

**Do**
- Lead with clarity: what the patient needs to know next
- Use plain language; keep clinical terms accurate when needed
- Direct CTAs: “Book a consultation”, “Manage booking”, “Email the clinic team”
- Short paragraphs; one idea per section

**Don’t**
- Hype (“revolutionary”, “cutting-edge AI”, “game-changing”)
- Emoji, exclamation stacks, or salesy urgency
- Scare tactics or guilt language
- Generic “happy patient” clichés or stock wellness copy

### Sample blurbs

**Homepage hero (supporting line)**  
Specialist oncology care that is precise, well informed, and built around each patient.

**Booking confirmation opener**  
Dear [Name], your consultation with Personalised Cancer Care is confirmed. The details are below.

**Clinic letter intro**  
Thank you for choosing Personalised Cancer Care. This letter confirms the arrangements for your appointment with Dr Karen Sayal.

---

## 4. Logo & wordmark

- **Mark:** site logo mark (`/logo-mark.png`) — use for favicon, app icon, compact headers.
- **Wordmark:** display serif for the practice or clinician name; small uppercase sans strapline beneath (e.g. “Consultant oncology care”).
- Keep generous clear space; do not stretch, recolour arbitrarily, or place on busy photography without a calm overlay.
- Prefer dark ink on cream/white; reverse (white on accent teal) only for solid accent bars or dark panels.

---

## 5. Colour system

| Token | Hex | Usage |
| --- | --- | --- |
| Ink | `#15202B` | Primary text |
| Ink soft | `#2A3644` | Secondary body text |
| Ink muted | `#5D6B78` | Captions, meta, hints |
| Cream | `#F8F7F4` / `#F7F4EC` | Soft panels, email header/footer |
| Mist | `#EEF2F4` | Page wash, email outer background |
| Line | `#DCE3E8` | Borders, dividers |
| Accent | `#1F6F6A` | Links, CTAs, eyebrows, focus rings |
| Accent deep | `#155652` / `#175551` | Hover / emphasised links |
| Accent soft | `#E4F1EF` / `#E3EFEC` | Chips, selected states, soft highlights |
| White | `#FFFFFF` | Main surfaces |

**Atmosphere:** white base with very light teal and ink radial washes — not flat purple gradients, not heavy dark mode, not terracotta-on-cream clichés.

**Selection:** accent-soft background with ink text.

---

## 6. Typography

### Fonts (web)

| Role | Family | Weights |
| --- | --- | --- |
| Display / headings | **Cormorant Garamond** | 500, 600, 700 (incl. italic where needed) |
| Body / UI | **Source Sans 3** | 400, 500, 600, 700 |

Google Fonts import used by the site:

```text
Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600
Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400
```

### Fallbacks

- Headings: `Georgia`, `ui-serif`, `serif`
- Body: `ui-sans-serif`, `system-ui`, `sans-serif`
- HTML email: Georgia for titles; Arial/Helvetica for body

### Scale & treatment

- **Eyebrow:** ~0.72rem, semibold, uppercase, tracking ~0.22em, accent colour
- **Display XL / LG / MD:** large clamp sizes, line-height ~1.05–1.15, slight negative letter-spacing
- **Body:** ~1.05rem, relaxed line-height
- Prefer editorial hierarchy over dense UI chrome

---

## 7. Layout & UI

- Spacious medical-editorial layout; **one job per section**
- Prefer open composition over card grids; cards only when they aid interaction
- Borders: thin `line` colour; corner radius modest (~3–8px)
- Container: wide content max (~80rem) with comfortable horizontal padding
- Section padding: generous vertical rhythm (~5–7rem on desktop)

### Components

| Element | Spec |
| --- | --- |
| Primary button | Solid accent, white text, semibold; slight radius |
| Secondary button | White fill, soft border, ink text |
| Text links | Accent / accent-deep on hover; underline sparingly |
| Forms | Clear labels, calm borders, ink focus via accent |
| Status chips | Accent-soft fill, accent-deep uppercase label |

### Motion

- Restrained fade-up on heroes/sections only
- Honour `prefers-reduced-motion`

### Imagery

- Real professional/clinical context where possible
- Avoid generic stock collages, floating badge stickers, and promo pill clusters

---

## 8. Email visual rules

- Max content width ~600px; mist outer background; white card
- Top accent bar (~6px) in teal
- Cream header with serif wordmark + uppercase sans strapline
- Status pill: accent-soft background, accent-deep uppercase text
- Detail block: cream card, light border, labelled rows
- Primary CTA: solid accent button
- Footer: cream strip with reply-to and site host links
- Attach calendar as `.ics` where relevant; steer changes to **Manage booking**

---

## 9. Locations (patient-facing)

For in-person appointments (current default clinic for bookings):

**HCA UK at University College Hospital**  
5th Floor UCH Macmillan Cancer Centre, Huntley Street, London, WC1E 6AG

Also practised at:

- LOC — Leaders in Oncology Care, 95 Harley Street, London, W1G 6AF  
- HCA Healthcare UK The Harley Street Clinic, 35 Weymouth Street, London, W1G 8BJ  

Virtual consultations: no physical location line; state “Virtual consultation”.

---

## 10. Do / Don’t

**Do**
- Keep brand/clinician name prominent on first viewport of branded pages
- Use Cormorant + Source Sans 3 and the teal/ink/cream palette
- Write in British English with a calm consultant tone
- Leave whitespace; favour clarity over decoration

**Don’t**
- Introduce purple/indigo startup themes, neon glow, or dark-mode-first looks
- Overuse rounded pills, multi-layer shadows, or floating promo badges
- Let secondary marketing clutter the hero
- Invent a second font stack or accent colour for “variety”

---

## 11. Quick reference (CSS tokens)

```css
--ink: #15202b;
--ink-soft: #2a3644;
--ink-muted: #5d6b78;
--cream: #f8f7f4;
--mist: #eef2f4;
--line: #dce3e8;
--accent: #1f6f6a;
--accent-deep: #155652;
--accent-soft: #e4f1ef;
--font-display: "Cormorant Garamond", Georgia, ui-serif, serif;
--font-sans: "Source Sans 3", ui-sans-serif, system-ui, sans-serif;
```

---

*Last aligned with the clinic landing page design system (Tailwind theme + booking email styles).*
