# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Secrets**: the Steam Web API key lives in the Gladys configuration (a
  `secret` field, never sent back to the browser). The integration sends it
  only to `https://api.steampowered.com`, in the query string as Steam
  requires, and never writes it to the logs or to `/data`: error messages are
  built without the request URL and scrubbed of the key.
- **`/data`**: `steam-state.json` holds the custom profile names already
  resolved to a SteamID64 and, per account, the current gaming session (game,
  start time, thresholds already fired). No key, no password.
- **Network**: outgoing HTTPS to `api.steampowered.com` only. The integration
  opens no port and listens to nothing; it is read-only on Steam.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and Steam and its Web API (report those to Valve).
