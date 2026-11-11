# Nøtteknekker-samlingen – oppsett (ca. 10 min)

Samme oppskrift som klubbkassa: Google Sheet + Apps Script + GitHub Pages.

## 1. Google Sheet + Apps Script
1. Lag et tomt Google Sheet, f.eks. «Nøtteknekkere».
2. **Extensions → Apps Script**. Slett innholdet i `Code.gs` og lim inn filen `Code.gs`.
3. Endre `ADMIN_PASSWORD` øverst i filen.
4. Velg funksjonen `setup` i nedtrekksmenyen og trykk **Run**. Godkjenn tilgangen. Da lages fanene *Samling* og *Gaver*.
5. **Deploy → New deployment → Select type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Kopier **Web app URL** (slutter på `/exec`).

## 2. Nettsiden
1. Åpne `index.html` og lim inn URL-en i `const API_URL = "";` øverst i `<script>`.
2. Legg filen i et GitHub-repo → **Settings → Pages → Deploy from a branch → main / root**.
3. Del lenken. Admin-siden ligger på `…/#admin`.

## Bruk
- **Samlingen**: alle kan søke og se. Trykk på et kort for detaljer.
- **Jeg kjøper gave**: gjestene sjekker først, så registrerer de kjøpet. Den som registrerte kan trykke «Angre» fra samme nettleser.
- **Admin** (passord): legg til, rediger og slett. Når en gave er mottatt: «Mottatt → samlingen» flytter den over med «Gave fra …».

## Greit å vite
- Bilder krympes til ca. 360 px så de passer i én celle i arket (maks 50 000 tegn).
- Uten `API_URL` kjører siden i demo-modus med lokal lagring. Passordet er da `demo`.
- Endrer du `Code.gs` senere: **Deploy → Manage deployments → Edit → Version: New version**. Ellers kjører den gamle koden videre.
- Passordet sjekkes på serveren, men det er ingen sperre mot gjetting. Det holder fint for familiebruk.
