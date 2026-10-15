# Steam Web API fixtures

Shapes of the real answers of the Steam Web API. The player data comes from the
fixtures of the Home Assistant `steam_online` integration (Apache-2.0,
`tests/components/steam_online/fixtures`), converted to the `GetPlayerSummaries`
**v2** layout (`response.players` is an array; v1 nests it under
`players.player`) and with invented SteamIDs (`7656119800000000x`). The
`ResolveVanityURL` and private-profile (`{ "response": {} }`) answers follow the
Valve documentation.
