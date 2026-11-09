# Sharepic Generator

Sharepics für Instagram, Facebook und TikTok sowie Veranstaltungsplakate im Design von BÜNDNIS 90/DIE GRÜNEN – direkt im Browser, ohne Installation.

**Live:** https://joanabayraktar.github.io/sharepicgenerator/

## Funktionen

- **Social Media:** Feed 4:5 und 3:4, Quadrat, Story/Reel/TikTok 9:16, Reel-Thumbnail, Facebook-Querformat
- **Karussells** mit durchgehendem Verlauf oder Panorama-Foto, Export aller Slides als ZIP
- **Plakate:** DIN A6 bis A1, optional 3 mm Beschnitt, Export als PDF
- **Vorlagen:** Titel, Text, Liste, Zahl, Zitat, Termin, Bild
- **Ebenen-Liste** wie in Figma: Elemente anpassen, ausblenden, sortieren, eigene Texte, Bilder und Emojis hinzufügen
- Rückgängig/Wiederherstellen, automatisches Speichern im Browser, Projekte als Datei speichern und laden

## Schriften

Die Headline-Schrift **GrueneType Neue** ist nicht enthalten (Lizenz). Ist sie auf dem Gerät installiert, wird sie automatisch genutzt – sonst lässt sie sich im Tool unter „Marke → Schrift laden“ einmalig hochladen (wird nur im eigenen Browser gespeichert). **PT Sans** wird über Google Fonts geladen.

## Lokal starten

Die Seite ist rein statisch (HTML, CSS, JavaScript). Lokal z. B. mit:

```bash
python -m http.server 5173
```

und dann http://localhost:5173 öffnen.

## Veröffentlichung

GitHub Pages aus dem Branch `main`, Ordner `/` (Root). Die Datei `.nojekyll` sorgt dafür, dass alle Dateien unverändert ausgeliefert werden.
