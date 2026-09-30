# notatki-blog

Blog z vaulta `Desktop/notatki`. Treść notatek jest kopiowana 1:1 (surowy markdown), niczego nie zmieniam.

## Otwieranie

- Dwuklik na `uruchom.command` — startuje lokalny serwer i otwiera stronę w przeglądarce.
- Albo dwuklik na `index.html` (działa też bez serwera, tylko czcionki wymagają internetu).

## Po zmianach w notatkach

```bash
python3 build.py
```

Odświeża `data.js`. Pomijane: `.obsidian`, folder `Prywatne` (klucze nie trafiają na bloga), pliki inne niż `.md`.
PDF-y z vaulta wrzucam ręcznie do `assets/` i wpisuję w `ATTACHMENTS` w `build.py`.

## Co gdzie

- `app.js` — na górze `CONFIG`: tytuł, podtytuł, spec-sheet, kolory sekcji i tagów, linie bootowania.
- `style.css` — na górze `:root`: kolory i fonty.
- `build.py` — generator danych.
