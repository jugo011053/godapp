# Preply

Ein Essensplaner für zwei. Er stellt eine Woche Essen zusammen, die zum
tatsächlichen Kalorien- und Proteinbedarf passt, und macht daraus die
Einkaufsliste.

- **Werbeseite:** https://jugo011053.github.io/godapp/
- **App:** https://jugo011053.github.io/godapp/v8/

Eine PWA ohne Build und ohne Framework — reine ES-Module. Auf dem Handy über
„Zum Home-Bildschirm" bzw. „App installieren" wie eine normale App nutzbar.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/index.html` | Werbeseite, liegt unter der Wurzel-Adresse |
| `app/v8/` | die App |
| `docs/` | Backend-Stand, Datenbank-Auftrag, Produktvision |
| `.github/workflows/` | Deploy nach GitHub Pages, Syntaxprüfung für `app/v8/` |

## Entwickeln

```bash
python3 -m http.server 8000 --directory app     # http://localhost:8000/v8/
```

Änderungen in `app/v8/**`, dabei `APP_BUILD` in `js/core/version.js` **und**
`CACHE_NAME` in `sw.js` zusammen hochzählen. Push nach `main` deployt.

Alles Weitere steht in [CLAUDE.md](CLAUDE.md).
