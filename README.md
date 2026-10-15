# Steam for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration that follows the **Steam status** of
chosen accounts (yours, your children's) through the official **Steam Web API**:

- **one device per account**: status (online, away, busy, offline…), online and in-game binaries, current game,
  length of the gaming session, playtime of the last two weeks, Steam level, last logoff;
- **scene triggers**: _starts playing_ (with the game), _stops playing_, _playing for more than…_ (15 minutes to
  4 hours, for parental control) and _comes online_;
- **a scene action**, _Read a Steam account_, to test in a scene whether someone is playing and what;
- **a dashboard widget**: every account, its status and its current game at a glance.

Read-only: nothing is ever changed on Steam. **Not affiliated with Valve**: Steam is a trademark of Valve
Corporation.

> **Developed without a real Steam account at hand: feedback welcome.** The code is tested against the real answer
> shapes of the Steam Web API (taken from the Home Assistant tests), but not yet against the live service.

## Requirements

- Gladys Assistant **5.1.0** or later.
- A free **Steam Web API key** from [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey)
  (Steam gives keys to accounts that have spent at least 5 USD).
- The accounts to follow, as SteamID64, profile URLs or custom URL names. The **current game** is only visible on
  **public profiles whose game details are public**; a private profile shows its status only.

## Installation

In Gladys: **Integrations → Install from GitHub**, paste `https://github.com/guim31/gladys-steam`, then fill in the
API key and the accounts in the **Configuration** tab, and add the accounts from the **Discovery** tab. The **Check
the accounts** button tells, for every entry, whether it was found and whether its profile is public.

The full user documentation is in [English](docs/en.md), [French](docs/fr.md), [German](docs/de.md) and
[Spanish](docs/es.md).

## How it works

- The container refreshes by itself on a timer (30 s to 5 min, 1 min by default): the core's polling of external
  devices is not reliable (GladysAssistant/Gladys#3198), and `onPoll` only stays as a fallback.
- One `GetPlayerSummaries` request reads every account at once; `GetSteamLevel` and `GetRecentlyPlayedGames` run
  every 30 minutes, only for the accounts added to Gladys. That is about 1,700 calls a day for three accounts, far
  from the 100,000 a day of the [Steam Web API Terms of Use](https://steamcommunity.com/dev/apiterms). A 429 pauses
  the refreshes for 5 minutes.
- Only changed states are sent to Gladys, with a heartbeat every 6 hours.
- Gaming sessions (and the thresholds already fired) are kept in `/data/steam-state.json`, so an update of the
  integration in the middle of a game does not reset the _playing for more than…_ counter. The API key is never
  written there, nor in the logs.

## Limits

- The current game and the playtime need a public profile with public game details.
- Steam itself updates the status with a delay of up to a few minutes; an "invisible" account looks offline.
- A game launched outside Steam is not seen.
- 20 accounts at most; the widget lists the first ten.

## Development

```bash
npm install
npm test                 # node --test, against the SDK's fake Gladys and a fake Steam API
npm run lint
npm run format:check
node scripts/probe.mjs   # read-only probe of the real Steam API (needs the network)
```

`scripts/probe.mjs` runs the integration's own client against `api.steampowered.com`: with no environment, a fake
key that every method must refuse; with `STEAM_API_KEY` and `STEAM_ACCOUNTS`, a real read that prints only the
shape of the answers (no name, no SteamID, no key).

Project rules for contributors and coding assistants: [CLAUDE.md](CLAUDE.md). Releases are made with the
**Release** workflow (Actions → Release), which bumps the versions and builds the image.

## Credits

- The Home Assistant [`steam_online`](https://www.home-assistant.io/integrations/steam_online/) integration
  (Apache-2.0, by the Home Assistant authors) for the choice of API methods and the persona states; the test
  fixtures of `test/fixtures/steam` are adapted from its tests.
- [Gladys Assistant](https://github.com/GladysAssistant/Gladys) and its
  [integration SDK](https://github.com/GladysAssistant/integration-sdk-js), by Pierre-Gilles Leymarie and the
  contributors.

## License

[Apache-2.0](LICENSE).
