# moler – Google Play: listing and forms

Copy these texts into Play Console. Graphics are in this folder:

| File | Where in Play Console |
|---|---|
| `play-icon-512.png` | Store listing → App icon (512×512) |
| `play-feature-graphic.png` | Store listing → Feature graphic (1024×500) |
| screenshots (take them yourself, see below) | Store listing → Phone screenshots (2–8) |

Privacy policy URL: **https://moler.expo.app/privacy**

---

## App details

- **App name:** moler
- **Default language:** Serbian (Latin) – `sr`; add **English (United States)** – `en-US` as a translation
- **App or game:** App
- **Free or paid:** Free
- **Category:** Business
- **Contact email:** slavko.parezanin@gmail.com

---

## Store listing – Srpski (sr)

**Kratak opis** (max 80 znakova):

> Beležite pozive, glasovne poruke i komentare, pa ih izvezite u XML.

**Pun opis** (max 4000 znakova):

> moler je jednostavan dnevnik telefonskih poziva za ljude koji rade sa klijentima – majstore, servisere, prodavce.
>
> Posle svakog poziva za nekoliko sekundi zabeležite:
> • broj, ime i adresu (poznati brojevi se sami popune)
> • vreme poziva, cenu i komentar
> • glasovnu poruku – govor se pretvara u tekst (srpski)
> • detalje iz evidencije poziva jednim dodirom: „Use last call“
>
> Pregled po pozivima ili po osobama: broj poziva, ukupna cena i trajanje razgovora za svakog klijenta.
>
> Izvoz u XML: jednim dodirom izvezite sve nove pozive i pošaljite fajl mejlom ili sačuvajte na Drive; kopija ostaje i u folderu Download/moler. Izvezeni pozivi se označe, tako da sledeći izvoz sadrži samo nove. Svaki raniji izvoz možete ponovo otvoriti i podeliti.
>
> Privatnost: svi podaci ostaju na vašem telefonu. Nema naloga, reklama ni analitike. Glasovna poruka se šalje na pretvaranje u tekst samo kada telefon nema sopstveni servis za prepoznavanje govora.

## Store listing – English (en-US)

**Short description** (max 80 characters):

> Log calls, voice notes and comments, then export them to XML.

**Full description** (max 4000 characters):

> moler is a simple phone call log for people who work with clients – tradespeople, service technicians, salespeople.
>
> After each call, record in a few seconds:
> • number, name and address (known numbers fill in automatically)
> • when the call happened, the price and a comment
> • a voice message – speech is turned into text (Serbian)
> • call log details with one tap: "Use last call"
>
> View by call or by person: number of calls, total price and talk time for each client.
>
> XML export: export all new calls with one tap and e-mail the file or save it to Drive; a copy is also kept in the Download/moler folder. Exported calls are marked, so the next export contains only new ones. Any earlier export can be opened and shared again.
>
> Privacy: all data stays on your phone. No accounts, ads or analytics. A voice message is sent for transcription only when the phone has no speech recognition service of its own.

---

## Screenshots

Play needs at least 2 phone screenshots (portrait, e.g. 1080×1920 or the phone's native size). Take them on the phone with sample data (not real clients):

1. Calls tab – the "Log a call" form filled in
2. Calls tab – the list with a few calls (Comments and Transcript visible)
3. People view – calls grouped per person
4. Exports tab – the list of exports
5. An export's detail screen

---

## App content (Policy → App content)

### Privacy policy
`https://moler.expo.app/privacy`

### Ads
**No**, the app does not contain ads.

### App access
**All functionality is available without special access** (no login).

### Content rating (IARC questionnaire)
- Category: **Utility, Productivity, Communication, or Other**
- Answer **No** to violence, sexuality, language, controlled substances, gambling.
- User interaction / sharing: users **cannot** interact or exchange content with other users in the app; the app **does not** share the user's location.
- Expected rating: **3+ / Everyone**.

### Target audience
**18 and over** (do not select ages under 13).

### News app
**No**.

### Government app / Financial features / Health
**No** / **None** / **None**.

### Data safety

**Does your app collect or share any of the required user data types?** → **Yes**

**Is all of the user data collected by your app encrypted in transit?** → **Yes** (HTTPS)

**Do you provide a way for users to request that their data is deleted?** → **Yes** (data is only on the device; uninstalling or "Clear data" deletes it). Leave the deletion URL empty unless Play insists; then use the privacy policy URL.

Data types – declare only this one:

| Data type | Collected | Shared | Processed ephemerally | Required/optional | Purpose |
|---|---|---|---|---|---|
| **Audio → Voice or sound recordings** | Yes | Yes (Google Cloud Speech-to-Text, as service provider) | **Yes** | Optional (only when the user records) | App functionality |

Why only this one: Google counts data as "collected" only when it leaves the device. Calls, contacts' names/numbers, comments and the call log stay in the local database and are never sent, so they are not declared. The voice recording leaves the device only for transcription on phones without a speech service, and is not stored.

> Note: transfers to a **service provider** that processes data on your behalf are allowed to be declared as not "shared". If you prefer the safer answer, keep **Shared: Yes** as in the table.

---

## Sensitive permissions → Call log (Permissions Declaration Form)

`READ_CALL_LOG` is restricted. Fill in the declaration (Policy → App content → Sensitive permissions → Call log). Suggested answers:

**Core functionality of the app:**

> moler is a call logging and client-tracking app for small businesses and tradespeople (an enterprise/CRM-style call log). Its core function is recording business calls: who called, when, how long, the price agreed, comments and a voice note, and exporting these records to XML for the business's own bookkeeping or CRM.

**Which permitted use case applies:** choose the closest available option, typically **"Caller ID, spam detection and blocking"** is *not* right – prefer a **CRM / call-logging / enterprise** option if listed; otherwise **"Other"** and explain below.

**Explanation of how the permission is used:**

> When the user taps "Use last call" on the "Log a call" form, the app reads only the single most recent entry of the device call log (number, date, type, duration, geocoded location, number label, country) to pre-fill the form. The app never reads the call log in the background, never reads more than the last entry, and never sends call log data off the device; it is stored only in the app's local database together with the user's own notes.

**Video:** Google usually asks for a short screen recording (≤ 30 s) showing: open the app → tap "Use last call" → permission prompt → form fills in. Record it on the phone with the built-in screen recorder and upload it (e.g. as an unlisted YouTube video).

If Google rejects the declaration: remove the permission from the Play build (a few-minute change in the app) and resubmit; the sideloaded APK can keep the feature.

---

## Release checklist

1. Create the Play Console developer account (one-time $25, identity verification).
2. Create the app (name **moler**, Serbian default language, App, Free).
3. Fill **App content** (everything above) and the **Store listing** for sr and en-US.
4. **Testing → Internal testing → Create release** → upload the `.aab` from EAS by hand (the first upload must be manual) → add yourself as a tester → install from the Play link and check everything works.
5. **Closed testing**: new personal accounts need **12+ testers opted in for 14 days** before production access can be requested.
6. Apply for **Production access**, then **Production → Create release** with the same or a newer `.aab`.
7. Later builds: `npx eas-cli@latest build -p android --profile production`, then `npx eas-cli@latest submit -p android --profile production` (needs a Google service-account key; set up once in Play Console → Setup → API access).
