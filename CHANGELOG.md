# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-15

### Added

- One Gladys device per followed Steam account (up to 20, entered as SteamID64,
  profile URL, custom URL name or `STEAM_0`/`[U:1:…]` id): status, online, in
  game, current game, gaming session length, playtime of the last two weeks,
  Steam level and last logoff.
- Scene triggers: starts playing (filter on the game), stops playing, playing
  for more than 15 minutes to 4 hours (once per session, kept across restarts),
  comes online.
- Scene action "Read a Steam account": status, online, in game, current game
  and session length for the next steps of a scene.
- "Steam accounts" dashboard widget: who is online, who plays what and for how
  long, and which profiles are private.
- "Check the accounts" button in the configuration: resolves every entry and
  tells whether its profile is public.
- Feature names and texts in English, French, German and Spanish, and the user
  documentation in the four languages.

[Unreleased]: https://github.com/guim31/gladys-steam/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-steam/releases/tag/v1.0.1
