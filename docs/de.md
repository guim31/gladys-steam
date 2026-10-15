# Steam

## Überblick

Diese Integration verfolgt den **Steam-Status** der Konten, die du auswählst (deines, das deiner Kinder, deiner Freunde): online oder nicht, das laufende Spiel und seit wann, die Spielzeit der letzten zwei Wochen, das Steam-Level und die letzte Abmeldung. Jedes Konto wird ein Gerät in Gladys, ein Dashboard-Widget zeigt alle auf einen Blick, und Szenen-Auslöser lassen Gladys reagieren, wenn jemand zu spielen beginnt oder aufhört, online geht oder zu lange spielt (Jugendschutz).

Die Integration liest die **offizielle Steam Web API** (`api.steampowered.com`) mit einem kostenlosen API-Schlüssel, nur lesend: auf Steam wird nie etwas verändert. Nicht mit Valve verbunden: Steam ist eine Marke der Valve Corporation.

Ohne echtes Steam-Konto entwickelt: Rückmeldungen sind willkommen.

## Voraussetzungen

- Gladys Assistant 5.1.0 oder neuer.
- Ein **Steam-Web-API-Schlüssel**, kostenlos: melde dich auf [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) an, gib einen beliebigen Domainnamen ein (zum Beispiel `localhost`) und kopiere den Schlüssel mit 32 Zeichen. Steam gibt Schlüssel nur an Konten, die mindestens 5 USD im Shop ausgegeben haben.
- Die zu verfolgenden Konten. Das **aktuelle Spiel** ist nur sichtbar, wenn das Profil **öffentlich** ist und seine **Spieldetails** ebenfalls (Steam: Profil bearbeiten, Privatsphäre-Einstellungen). Ein privates Profil zeigt trotzdem seinen Status (online, abwesend…), aber nie sein Spiel.

## Konfiguration

In Gladys: **Integrationen**, **Steam**, **Konfiguration**:

| Feld                       | Inhalt                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Steam-API-Schlüssel        | Der von steamcommunity.com/dev/apikey kopierte Schlüssel. In der Konfiguration von Gladys gespeichert, nie in die Protokolle geschrieben.                                                                                                                        |
| Zu verfolgende Konten      | Bis zu 20, durch Kommas getrennt: eine SteamID64 (`76561198…`, angezeigt auf store.steampowered.com/account), eine Profil-URL (`https://steamcommunity.com/id/name/` oder `/profiles/7656…`), ein eigener URL-Name, oder die Formen `STEAM_0:1:…` und `[U:1:…]`. |
| Aktualisierungsintervall   | 30 Sekunden, 1, 2 oder 5 Minuten (standardmäßig 1 Minute).                                                                                                                                                                                                       |
| Sprache der Funktionsnamen | Englisch, Französisch (Standard), Deutsch oder Spanisch: die Namen der Funktionen beim Anlegen und die Texte an die Szenen.                                                                                                                                      |

Öffne dann den Tab **Entdecken** und füge die gewünschten Konten als Geräte hinzu. Die Schaltfläche **Konten prüfen** unter der Konfiguration löst jeden Eintrag auf und zeigt, ob sein Profil öffentlich ist.

## Geräte

Ein Gerät pro Konto, benannt mit „Steam“ und dem Steam-Namen. Alle Funktionen sind nur lesbar.

| Funktion             | Typ             | Inhalt                                                                                                      |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| Status               | Text            | Offline, Online, Beschäftigt, Abwesend, Schlummern, Sucht Tauschpartner, Sucht Mitspieler.                  |
| Online               | Binär           | 1, wenn das Konto nicht offline ist.                                                                        |
| Im Spiel             | Binär           | 1, solange ein Spiel läuft (nur öffentliche Profile).                                                       |
| Aktuelles Spiel      | Text            | Der Name des Spiels, sonst „Keins“.                                                                         |
| Spielsitzung         | Dauer (Minuten) | Dauer der laufenden Sitzung, 0 außerhalb eines Spiels. Siehe „Spielt seit mehr als…“, was eine Sitzung ist. |
| Spielzeit (2 Wochen) | Dauer (Stunden) | Gesamte Spielzeit der letzten zwei Wochen, alle 30 Minuten gelesen.                                         |
| Steam-Level          | Zähler          | Das Steam-Level, alle 30 Minuten gelesen.                                                                   |
| Zuletzt abgemeldet   | Text            | Datum und Uhrzeit der letzten Abmeldung, in der Zeitzone von Gladys.                                        |

Die binären Funktionen und die Dauern lassen sich in den Szenen-Bedingungen von Gladys verwenden („Im Spiel“ gleich 1, „Spielsitzung“ über 60).

## Widget

**Steam-Konten**: zwei Kacheln (Anzahl der Konten im Spiel, Konten online) und eine Zeile pro Konto (höchstens zehn): das Spiel und die Sitzungsdauer beim Spielen, sonst der Status, mit einer Farbe (grün im Spiel, blau online, orange beschäftigt oder abwesend, grau offline). Ein Hinweis nennt die privaten Profile. Das Widget zeigt die letzte Aktualisierung: es fragt Steam nie selbst.

## Szenen-Auslöser

Jeder Auslöser lässt sich auf ein Konto beschränken (leer: jedes Konto) und gibt den Kontonamen an die Aktionen der Szene weiter.

| Auslöser              | Wann                                                                                                                                                                                                                                                                                                              | Weitergegebene Informationen        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Beginnt zu spielen    | Ein Spiel startet, oder der Spieler wechselt zu einem anderen. Optionaler Filter: der genaue Name des Spiels.                                                                                                                                                                                                     | Kontoname, Spiel, Steam-App-ID      |
| Hört auf zu spielen   | Ein Spiel endet, oder der Spieler wechselt zu einem anderen. Optionaler Filter: das Spiel.                                                                                                                                                                                                                        | Kontoname, Spiel, gespielte Minuten |
| Spielt seit mehr als… | Die **Spielsitzung** erreicht die gewählte Dauer (15, 30, 45 Minuten, 1, 1,5, 2, 3 oder 4 Stunden). Eine Sitzung ist durchgehendes Spielen, egal welches Spiel: ein Spielwechsel verlängert sie, eine Pause unter 10 Minuten auch. Er löst einmal pro Sitzung und Dauer aus, auch nach einem Neustart von Gladys. | Kontoname, Spiel, erreichte Minuten |
| Geht online           | Das Konto wechselt von offline zu einem anderen Status.                                                                                                                                                                                                                                                           | Kontoname, Status                   |

Die erste Aktualisierung nach dem Start der Integration erfasst nur die Lage: sie löst nichts aus.

## Szenen-Aktion

**Steam-Konto lesen** gibt den nächsten Schritten der Szene den Status, online (ja/nein), im Spiel (ja/nein), das aktuelle Spiel und die Sitzungsdauer eines Kontos. Die Aktion liest die letzte Aktualisierung, ohne Steam zu fragen: kombiniere sie mit „Nur fortfahren, wenn“, um nur zu handeln, wenn das Konto spielt.

## Konfigurationsaktion

**Konten prüfen** löst jeden Eintrag des Kontenfelds auf und antwortet für jeden mit dem Steam-Namen, der SteamID64 und ob das Profil öffentlich ist, oder warum der Eintrag nicht gefunden wurde.

## Szenen-Beispiele

- **Schlafenszeit**: an jedem Schultag um 21 Uhr „Steam-Konto lesen“ auf dem Konto deines Kindes, „Nur fortfahren, wenn“ im Spiel wahr ist, dann „Zeit, [Spiel] zu beenden“ auf dem Lautsprecher des Hauses ansagen.
- **Bildschirmzeit**: Auslöser „Spielt seit mehr als… 2 Stunden“ auf dem Konto deines Kindes, dann dir eine Nachricht „Léo spielt seit 2 Stunden ([Spiel])“ schicken und das Licht im Zimmer dimmen.
- **Spieleabend**: Auslöser „Beginnt zu spielen“ auf deinem Konto, dann das Wohnzimmer auf die Szene „Gaming“ stellen und die Benachrichtigungen stummschalten.

## Aktualisierung und Steam-Kontingente

Die Integration aktualisiert sich selbst im gewählten Intervall (sie hängt nicht vom Abfragen durch Gladys ab). Eine einzige Anfrage liest alle Konten auf einmal; Level und Spielzeit werden alle 30 Minuten gelesen, nur für die zu Gladys hinzugefügten Konten. Mit dem Standardintervall und drei hinzugefügten Konten sind das etwa 1.700 Anfragen pro Tag, weit unter den **100.000 Aufrufen pro Tag**, die die [Nutzungsbedingungen der Steam Web API](https://steamcommunity.com/dev/apiterms) erlauben. Antwortet Steam mit „zu viele Anfragen“ (HTTP 429), pausiert die Integration 5 Minuten. Steam selbst aktualisiert den Status mit einer Verzögerung von bis zu einigen Minuten.

## Fehlerbehebung

- **„Steam hat den API-Schlüssel abgelehnt“** in der Konfiguration: kopiere den Schlüssel erneut von steamcommunity.com/dev/apikey (32 Zeichen, ohne Leerzeichen).
- **Kein Spiel angezeigt, obwohl jemand spielt**: das Profil oder seine Spieldetails sind nicht öffentlich. „Konten prüfen“ sagt es, das Widget auch.
- **Ein Konto fehlt im Tab Entdecken**: prüfe die Schreibweise mit „Konten prüfen“; der eigene URL-Name steht in der Profil-URL nach `/id/`, es ist nicht der angezeigte Name.
- **Steam antwortet nicht**: die Integration behält die letzten bekannten Zustände und versucht es in jedem Intervall erneut; die Konfiguration zeigt es an.
- **Mehr Details**: setze die Umgebungsvariable `LOG_LEVEL=debug` am Container. Die normalen Protokolle enthalten nur Starts, Fehler und Wiederherstellungen.

## Grenzen

- Nur lesend: keine Nachricht, keine Freunde, kein Kauf, auf Steam ändert sich nichts.
- Das aktuelle Spiel und die Spielzeit brauchen ein öffentliches Profil mit öffentlichen Spieldetails: sonst verbirgt Steam sie, sogar vor dem Schlüssel des Kontoinhabers.
- Der Status von Steam selbst kann einige Minuten hinterherhinken, und ein „unsichtbares“ Konto wirkt offline.
- Ein außerhalb von Steam gestartetes Spiel wird nicht erkannt; ein zur Bibliothek hinzugefügtes Nicht-Steam-Spiel erscheint eventuell nur mit seinem Namen.
- Höchstens 20 Konten; das Widget listet die ersten zehn.
- Ohne echtes Steam-Konto entwickelt: Rückmeldungen sind im Gladys-Forum willkommen.
