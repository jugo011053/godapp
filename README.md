# Preply

Persönliche Essenspläne, passende Rezepte und eine automatisch erzeugte Einkaufsliste.

**→ [App öffnen](https://jugo011053.github.io/godapp/)**

Kurzes Profil ausfüllen, passenden Essensplan bekommen, Gerichte per Klick tauschen — die Einkaufsliste rechnet sich daraus selbst zusammen. Ohne Account nutzbar; ein Login gibt es nur für Cloud-Speicherung und den geteilten Haushalt.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/` | **die App** — Single-File-PWA plus Manifest, Service Worker und Icons |
| `docs/` | Produktvision, Backend-Struktur, Merge-Landkarte, Testliste |
| `archive/` | alte Stände, nicht mehr gepflegt |
| `CLAUDE.md` | Kontextdatei für die Arbeit mit Claude Code |

Die App ist bewusst eine einzelne HTML-Datei: kein Build, kein Framework, kein Paketmanager. Bearbeiten heißt `app/index.html` bearbeiten.

## Lokal starten

Ein Webserver ist nötig — per Doppelklick funktionieren Service Worker und einige Browser-APIs nicht.

```bash
cd app
python3 -m http.server 8080
# http://localhost:8080
```

## Deployment

Jeder Push nach `main`, der `app/**` verändert, veröffentlicht die App automatisch über GitHub Pages (`.github/workflows/deploy-pages.yml`).

## Technik

Vanilla HTML/CSS/JS als installierbare PWA, Supabase für Login, Cloud-Speicherung und den geteilten Haushalt. Der im Frontend enthaltene Supabase-Key ist der öffentliche `anon`-Key — die Daten sind über Row Level Security geschützt.
