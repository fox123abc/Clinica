# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary audience of the public landing:** the professor / academic jury evaluating the project. They must leave convinced the site looks professional and that the system really works.
- **Users inside the product:** patients (register, request, reschedule and cancel appointments), receptionists (confirm or cancel any appointment), doctors (see their agenda, mark appointments as attended) and administrators (manage specialties, doctors and their weekly availability).

## Product Purpose

Clínica Altavida is an online medical appointment system for a fictional clinic in Colombia. It centralizes the agenda of every specialty so a patient can see the real availability of each doctor and request an appointment without phone calls or crossed messages. Success: no double bookings, and each role sees only its own work.

## Positioning

Availability is real, not a contact form: the patient picks from slots computed from each doctor's weekly schedule minus slots already taken, and the database refuses two bookings of the same doctor, date and time. Every appointment moves through a visible lifecycle: pendiente → confirmada → atendida, or cancelada.

## Operating Context

- Academic project with demonstration purposes; runs locally (Node.js + Express + SQLite) or with Docker on port 8080.
- Demo accounts exist for each role (password `Altavida2026`); they must never be presented as real credentials for production.
- Server validates dates with Colombia's time zone (America/Bogota).

## Capabilities and Constraints

- Implemented: registration and login with roles, appointment request with real slots, reschedule and cancel, reception confirm/cancel, doctor agenda and "attended", admin catalog and schedules.
- Provisional rules (open hotspots in docs/DDD-EVENT-STORMING.md §9): manual confirmation by reception, no minimum notice to cancel.
- Stack: static HTML/CSS pages + Vue.js 3 (CDN) for dynamic views; no build step.
- Location: Colombia, no city or address named.

## Brand Commitments

- Name **Clínica Altavida** and its cross logo mark must be kept.
- Language: Spanish (Colombia), "tú" form.

## Evidence on Hand

- Catalog data is placeholder (`[Especialidad 1]`, `[Médico 1]`…); real specialties and doctor names do not exist yet.
- No institutional description, history, photos, testimonials, statistics or addresses exist. None may be fabricated; any demonstration data shown on the landing must read as an illustrative example.

## Product Principles

1. Show the mechanism working instead of claiming it: real slots, real states.
2. Never invent facts about the clinic.
3. Each role reaches its own work in one step.
4. Clarity over decoration: a patient (or a jury member) understands what to do within seconds.

## Accessibility & Inclusion

WCAG 2.1 AA contrast and keyboard access across public and private pages.
