# Archiv — nicht mehr bearbeiten

Diese Dateien sind **tot**. Sie werden nicht deployt und nicht mehr gepflegt.
Sie liegen hier nur zum Nachschlagen.

Die einzige lebende Datei der App ist **`app/index.html`**.

| Datei | Was es ist | Warum tot |
|---|---|---|
| `index_latest.html` | D1-Arbeitsstand vor dem Preply-Merge | Ersetzt durch `app/index.html`. Trug irreführend dieselbe `APP_VERSION`. |
| `index.html` | ältere Kopie desselben Stands | Reine Dublette. |
| `godapp.html` | allererster Stand der App | Historisch. |

## Achtung bei Versionsnummern

Alle drei Dateien enthalten `APP_VERSION='godapp6.7.1'` — **genau wie die lebende
App**. An der Versionsnummer lässt sich also *nicht* erkennen, welche Datei aktuell
ist. Verlass dich auf den Pfad, nicht auf die Version.

Wiederherstellen ginge jederzeit über die Git-Historie; ein Zurückkopieren an den
alten Ort würde aber genau die Verwechslung wieder einführen, wegen der hier
aufgeräumt wurde.
