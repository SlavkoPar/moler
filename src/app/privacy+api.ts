/**
 * Privacy policy for the Google Play listing, served at https://moler.expo.app/privacy.
 * It is an API route returning plain HTML so it doesn't become a tab in the app.
 * Keep it in sync with what the app actually does with data.
 */

const CONTACT_EMAIL = 'slavko.parezanin@gmail.com';
const LAST_UPDATED = '2026-10-11';

const html = `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>moler – Politika privatnosti / Privacy policy</title>
<style>
  :root { color-scheme: light dark; --text: #1c1c1e; --muted: #5f6368; --bg: #ffffff; --line: #e3e3e8; --accent: #208aef; }
  @media (prefers-color-scheme: dark) { :root { --text: #f2f2f7; --muted: #a1a1aa; --bg: #111113; --line: #2c2c30; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 20px; margin: 32px 0 8px; }
  p, li { margin: 8px 0; }
  .muted { color: var(--muted); }
  nav a, a { color: var(--accent); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 48px 0; }
</style>
</head>
<body>
<main>
<nav><a href="#sr">Srpski</a> · <a href="#en">English</a></nav>

<section id="sr" lang="sr">
<h1>moler – Politika privatnosti</h1>
<p class="muted">Poslednja izmena: ${LAST_UPDATED}</p>

<p>moler je aplikacija za beleženje telefonskih poziva: broj, ime, adresu, vreme, cenu, komentar, glasovnu poruku i njen tekst. Ova politika objašnjava koje podatke aplikacija koristi i gde oni idu.</p>

<h2>Podaci ostaju na vašem telefonu</h2>
<p>Svi pozivi, osobe, komentari, transkripti, glasovne poruke i izvozi čuvaju se samo u lokalnoj bazi podataka aplikacije na vašem uređaju. Aplikacija nema korisničke naloge, ne šalje podatke na naš server radi čuvanja, ne koristi analitiku ni reklame i ne prodaje niti deli podatke sa trećim stranama.</p>

<h2>Mikrofon i pretvaranje govora u tekst</h2>
<p>Mikrofon se koristi samo kada sami pokrenete snimanje glasovne poruke ili diktiranje. Snimak se čuva na telefonu.</p>
<ul>
<li>Ako telefon ima servis za prepoznavanje govora (npr. Google), tekst pravi taj servis. Na njega se primenjuju pravila privatnosti proizvođača tog servisa.</li>
<li>Ako telefon nema takav servis, snimak se posle snimanja šalje preko HTTPS-a na naš server (moler.expo.app, hostovan na Expo/EAS Hosting) i dalje na Google Cloud Speech-to-Text, samo da bi se pretvorio u tekst. Naš server snimak ne čuva; vraća samo prepoznati tekst. Google obrađuje zvuk prema <a href="https://cloud.google.com/speech-to-text/docs/data-logging">pravilima za Cloud Speech-to-Text</a> i, po podrazumevanim podešavanjima, ne čuva ga.</li>
</ul>

<h2>Evidencija poziva</h2>
<p>Ako dozvolite pristup evidenciji poziva, aplikacija čita samo poslednji poziv, i to tek kada dodirnete „Use last call“, da bi popunila broj, vreme i trajanje. Ti podaci ostaju na telefonu i ne šalju se nikuda.</p>

<h2>Izvoz u XML</h2>
<p>Kada izvezete pozive, aplikacija napravi XML fajl i otvori deljenje. Fajl ide samo tamo gde ga vi pošaljete ili sačuvate. Glasovne poruke se ne izvoze, samo njihova dužina.</p>

<h2>Brisanje podataka</h2>
<p>Poziv brišete dugim pritiskom na njega. Sve podatke brišete deinstaliranjem aplikacije ili preko Podešavanja → Aplikacije → moler → Memorija → Obriši podatke.</p>

<h2>Deca</h2>
<p>Aplikacija nije namenjena deci mlađoj od 13 godina.</p>

<h2>Kontakt</h2>
<p>Pitanja o privatnosti: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</section>

<hr>

<section id="en" lang="en">
<h1>moler – Privacy policy</h1>
<p class="muted">Last updated: ${LAST_UPDATED}</p>

<p>moler is an app for logging phone calls: number, name, address, time, price, comment, a voice message and its text. This policy explains which data the app uses and where it goes.</p>

<h2>Your data stays on your phone</h2>
<p>All calls, people, comments, transcripts, voice messages and exports are stored only in the app's local database on your device. The app has no user accounts, does not send data to our server for storage, uses no analytics or ads, and does not sell or share data with third parties.</p>

<h2>Microphone and speech-to-text</h2>
<p>The microphone is used only when you start recording a voice message or dictating. The recording is stored on your phone.</p>
<ul>
<li>If your phone has a speech recognition service (e.g. Google), that service produces the text. The privacy terms of that service's provider apply.</li>
<li>If your phone has no such service, the recording is sent after recording over HTTPS to our server (moler.expo.app, hosted on Expo/EAS Hosting) and on to Google Cloud Speech-to-Text, solely to turn it into text. Our server does not store the recording; it only returns the recognized text. Google processes the audio under the <a href="https://cloud.google.com/speech-to-text/docs/data-logging">Cloud Speech-to-Text terms</a> and, by default, does not retain it.</li>
</ul>

<h2>Call log</h2>
<p>If you allow call log access, the app reads only the most recent call, and only when you tap "Use last call", to fill in its number, time and duration. That data stays on your phone and is not sent anywhere.</p>

<h2>XML export</h2>
<p>When you export calls, the app creates an XML file and opens the share sheet. The file goes only where you send or save it. Voice messages are not exported, only their length.</p>

<h2>Deleting data</h2>
<p>Delete a call by long-pressing it. Delete all data by uninstalling the app, or via Settings → Apps → moler → Storage → Clear data.</p>

<h2>Children</h2>
<p>The app is not directed at children under 13.</p>

<h2>Contact</h2>
<p>Privacy questions: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
</section>
</main>
</body>
</html>`;

export function GET() {
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
