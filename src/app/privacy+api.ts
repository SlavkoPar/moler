/**
 * Privacy policy for the Google Play listing, served at https://moler.expo.app/privacy.
 * It is an API route returning plain HTML so it doesn't become a tab in the app.
 * Keep it in sync with what the app actually does with data.
 */

const CONTACT_EMAIL = 'slavko.parezanin@gmail.com';
const LAST_UPDATED = '2026-10-19';

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

<h2>Gde se čuvaju podaci</h2>
<p>U offline režimu (podrazumevano) svi pozivi, osobe, komentari, transkripti, glasovne poruke i izvozi čuvaju se samo u lokalnoj bazi podataka aplikacije na vašem uređaju. Podaci se šalju na server radi čuvanja samo ako sami uključite online režim (vidi ispod). Aplikacija ne koristi analitiku ni reklame i ne prodaje niti deli podatke sa trećim stranama.</p>

<h2>Online režim (radni prostor)</h2>
<p>U Podešavanjima možete izabrati online režim. Tada se svaki sačuvan poziv (broj, ime, adresa, vreme, cena, komentar, detalji poziva, transkript i glasovna poruka) šalje preko HTTPS-a na moler servis (molers.onrender.com) u radni prostor koji ste registrovali, gde ga vide korisnici tog radnog prostora. Poziv ostaje sačuvan i na telefonu. U offline režimu (podrazumevano) ništa se ne šalje.</p>

<h2>Mikrofon i pretvaranje govora u tekst</h2>
<p>Mikrofon se koristi samo kada sami pokrenete snimanje glasovne poruke ili diktiranje. Snimak se čuva na telefonu.</p>
<ul>
<li>Ako telefon ima servis za prepoznavanje govora (npr. Google), tekst pravi taj servis. Na njega se primenjuju pravila privatnosti proizvođača tog servisa.</li>
<li>Ako telefon nema takav servis, snimak se posle snimanja šalje preko HTTPS-a na naš server (moler.expo.app, hostovan na Expo/EAS Hosting) i dalje na Google Cloud Speech-to-Text, samo da bi se pretvorio u tekst. Naš server snimak ne čuva; vraća samo prepoznati tekst. Google obrađuje zvuk prema <a href="https://cloud.google.com/speech-to-text/docs/data-logging">pravilima za Cloud Speech-to-Text</a> i, po podrazumevanim podešavanjima, ne čuva ga.</li>
</ul>

<h2>Evidencija poziva</h2>
<p>Ako dozvolite pristup evidenciji poziva, aplikacija čita samo poslednji poziv, i to tek kada dodirnete „Use last call“, da bi popunila broj, vreme i trajanje. Ti podaci ostaju na telefonu i ne šalju se nikuda.</p>

<h2>Izvoz u XML</h2>
<p>Kada izvezete pozive, aplikacija napravi XML fajl, sačuva kopiju u folderu Download/moler na telefonu i otvori deljenje. Fajl ide samo tamo gde ga vi pošaljete ili sačuvate. Glasovne poruke se ne izvoze, samo njihova dužina.</p>

<h2>Uvoz</h2>
<p>Na kartici Imports možete izabrati folder sa izvezenim fajlovima (npr. od kolega). Aplikacija čita samo fajlove čije ime počinje sa „moler-calls“ iz foldera koji vi izaberete i čuva pozive iz njih u lokalnoj bazi na telefonu, odvojeno od vaših poziva.</p>
<p>Za uvoz iz Google Drive foldera, folder delite (samo za čitanje) sa servisnim nalogom aplikacije. Naš server (moler.expo.app) tada preuzima fajlove „moler-calls…“ iz tog foldera i prosleđuje ih vašem telefonu; server ih ne čuva. Server može da čita samo foldere koje ste sami podelili sa tim nalogom.</p>

<h2>Brisanje podataka</h2>
<p>Poziv brišete dugim pritiskom na njega. Sve podatke brišete deinstaliranjem aplikacije ili preko Podešavanja → Aplikacije → moler → Memorija → Obriši podatke. Izvezene XML fajlove iz foldera Download/moler brišete u aplikaciji Datoteke.</p>

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

<h2>Where your data is stored</h2>
<p>In offline mode (the default) all calls, people, comments, transcripts, voice messages and exports are stored only in the app's local database on your device. Data is sent to a server for storage only if you turn on online mode yourself (see below). The app uses no analytics or ads, and does not sell or share data with third parties.</p>

<h2>Online mode (workspace)</h2>
<p>In Settings you can choose online mode. Each saved call (number, name, address, time, price, comment, call details, transcript and voice message) is then sent over HTTPS to the moler service (molers.onrender.com), into the workspace you registered, where the users of that workspace can see it. The call is also kept on the phone. In offline mode (the default) nothing is sent.</p>

<h2>Microphone and speech-to-text</h2>
<p>The microphone is used only when you start recording a voice message or dictating. The recording is stored on your phone.</p>
<ul>
<li>If your phone has a speech recognition service (e.g. Google), that service produces the text. The privacy terms of that service's provider apply.</li>
<li>If your phone has no such service, the recording is sent after recording over HTTPS to our server (moler.expo.app, hosted on Expo/EAS Hosting) and on to Google Cloud Speech-to-Text, solely to turn it into text. Our server does not store the recording; it only returns the recognized text. Google processes the audio under the <a href="https://cloud.google.com/speech-to-text/docs/data-logging">Cloud Speech-to-Text terms</a> and, by default, does not retain it.</li>
</ul>

<h2>Call log</h2>
<p>If you allow call log access, the app reads only the most recent call, and only when you tap "Use last call", to fill in its number, time and duration. That data stays on your phone and is not sent anywhere.</p>

<h2>XML export</h2>
<p>When you export calls, the app creates an XML file, keeps a copy in the Download/moler folder on your phone and opens the share sheet. The file goes only where you send or save it. Voice messages are not exported, only their length.</p>

<h2>Import</h2>
<p>On the Imports tab you can choose a folder with exported files (e.g. from colleagues). The app reads only files whose name starts with "moler-calls" from the folder you choose and stores their calls in the local database on your phone, separate from your own calls.</p>
<p>To import from a Google Drive folder, you share the folder (view only) with the app's service account. Our server (moler.expo.app) then downloads the "moler-calls…" files from that folder and passes them to your phone; the server does not store them. The server can only read folders you have shared with that account yourself.</p>

<h2>Deleting data</h2>
<p>Delete a call by long-pressing it. Delete all data by uninstalling the app, or via Settings → Apps → moler → Storage → Clear data. Exported XML files in Download/moler are deleted in the Files app.</p>

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
