// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish "usted" (test/i18n.test.js checks it).
// Feature names and states follow the `language` of the configuration (a
// device integration does not receive the user's language); widget contents
// follow the language of the dashboard request.
// -----------------------------------------------------------------------------

/** Steam persona states (GetPlayerSummaries `personastate`), by number. */
export const STATUS_KEYS = [
  'offline',
  'online',
  'busy',
  'away',
  'snooze',
  'looking_to_trade',
  'looking_to_play',
];

/** Feature names, fixed by Gladys when the device is created. */
export const NAMES = {
  en: {
    status: 'Status',
    online: 'Online',
    in_game: 'In game',
    game: 'Current game',
    session: 'Gaming session',
    playtime_2weeks: 'Playtime (2 weeks)',
    level: 'Steam level',
    last_logoff: 'Last logoff',
  },
  fr: {
    status: 'Statut',
    online: 'En ligne',
    in_game: 'En jeu',
    game: 'Jeu en cours',
    session: 'Session de jeu',
    playtime_2weeks: 'Temps de jeu (2 semaines)',
    level: 'Niveau Steam',
    last_logoff: 'Dernière déconnexion',
  },
  de: {
    status: 'Status',
    online: 'Online',
    in_game: 'Im Spiel',
    game: 'Aktuelles Spiel',
    session: 'Spielsitzung',
    playtime_2weeks: 'Spielzeit (2 Wochen)',
    level: 'Steam-Level',
    last_logoff: 'Zuletzt abgemeldet',
  },
  es: {
    status: 'Estado',
    online: 'En línea',
    in_game: 'Jugando',
    game: 'Juego actual',
    session: 'Sesión de juego',
    playtime_2weeks: 'Tiempo de juego (2 semanas)',
    level: 'Nivel de Steam',
    last_logoff: 'Última desconexión',
  },
};

/** Persona state labels. */
export const STATUS_LABELS = {
  en: {
    offline: 'Offline',
    online: 'Online',
    busy: 'Busy',
    away: 'Away',
    snooze: 'Snooze',
    looking_to_trade: 'Looking to trade',
    looking_to_play: 'Looking to play',
  },
  fr: {
    offline: 'Hors ligne',
    online: 'En ligne',
    busy: 'Occupé',
    away: 'Absent',
    snooze: 'En veille',
    looking_to_trade: 'Cherche à échanger',
    looking_to_play: 'Cherche à jouer',
  },
  de: {
    offline: 'Offline',
    online: 'Online',
    busy: 'Beschäftigt',
    away: 'Abwesend',
    snooze: 'Schlummern',
    looking_to_trade: 'Sucht Tauschpartner',
    looking_to_play: 'Sucht Mitspieler',
  },
  es: {
    offline: 'Desconectado',
    online: 'En línea',
    busy: 'Ocupado',
    away: 'Ausente',
    snooze: 'Durmiendo',
    looking_to_trade: 'Busca intercambio',
    looking_to_play: 'Busca partida',
  },
};

/** Short texts: feature states and widget parts. */
export const TEXT = {
  noGame: { en: 'None', fr: 'Aucun', de: 'Keins', es: 'Ninguno' },
  unknown: { en: 'Unknown', fr: 'Inconnue', de: 'Unbekannt', es: 'Desconocida' },
  inGame: { en: 'In game', fr: 'En jeu', de: 'Im Spiel', es: 'Jugando' },
  online: { en: 'Online', fr: 'En ligne', de: 'Online', es: 'En línea' },
  minutes: { en: 'min', fr: 'min', de: 'Min.', es: 'min' },
  notConfigured: {
    en: 'Enter your Steam API key and the accounts to follow in the integration configuration.',
    fr: "Saisissez votre clé d'API Steam et les comptes à suivre dans la configuration de l'intégration.",
    de: 'Gib deinen Steam-API-Schlüssel und die zu verfolgenden Konten in der Konfiguration der Integration ein.',
    es: 'Introduzca su clave de API de Steam y las cuentas a seguir en la configuración de la integración.',
  },
  waiting: {
    en: 'Waiting for the first answer from Steam…',
    fr: 'En attente de la première réponse de Steam…',
    de: 'Warte auf die erste Antwort von Steam…',
    es: 'Esperando la primera respuesta de Steam…',
  },
  privateProfiles: {
    en: 'Private profile, current game hidden:',
    fr: 'Profil privé, jeu en cours invisible :',
    de: 'Privates Profil, aktuelles Spiel verborgen:',
    es: 'Perfil privado, juego actual oculto:',
  },
  moreAccounts: {
    en: 'more accounts not shown',
    fr: 'autres comptes non affichés',
    de: 'weitere Konten nicht angezeigt',
    es: 'cuentas más no mostradas',
  },
  steamUnreachable: {
    en: 'Steam does not answer, last known states shown.',
    fr: 'Steam ne répond pas, derniers états connus affichés.',
    de: 'Steam antwortet nicht, letzte bekannte Zustände angezeigt.',
    es: 'Steam no responde, se muestran los últimos estados conocidos.',
  },
};

/** Connection statuses and action messages (≤ 200 characters). */
export const MESSAGES = {
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les journaux de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  notConfigured: TEXT.notConfigured,
  invalidKey: {
    en: 'Steam refused the API key: check it on steamcommunity.com/dev/apikey.',
    fr: "Steam a refusé la clé d'API : vérifiez-la sur steamcommunity.com/dev/apikey.",
    de: 'Steam hat den API-Schlüssel abgelehnt: prüfe ihn auf steamcommunity.com/dev/apikey.',
    es: 'Steam ha rechazado la clave de API: compruébela en steamcommunity.com/dev/apikey.',
  },
  unreachable: {
    en: 'Steam does not answer for now: the integration keeps trying.',
    fr: "Steam ne répond pas pour l'instant : l'intégration réessaie.",
    de: 'Steam antwortet gerade nicht: die Integration versucht es weiter.',
    es: 'Steam no responde por ahora: la integración sigue intentándolo.',
  },
  noAccountFound: {
    en: 'None of the accounts entered was found on Steam: check the accounts field.',
    fr: "Aucun des comptes saisis n'a été trouvé sur Steam : vérifiez le champ des comptes.",
    de: 'Keines der eingegebenen Konten wurde auf Steam gefunden: prüfe das Feld der Konten.',
    es: 'Ninguna de las cuentas introducidas se ha encontrado en Steam: compruebe el campo de cuentas.',
  },
};

/** Lines of the "Check the accounts" action report, one per account entry. */
export const REPORT = {
  en: {
    found: (name, steamid) => `${name} (${steamid})`,
    public: 'public profile',
    private: 'private profile: status only, game hidden',
    notFound: (input) => `${input}: not found on Steam`,
    invalid: (input) => `${input}: not a SteamID, a profile URL or a custom name`,
    unresolved: (input) => `${input}: could not be checked now`,
    none: 'No account entered.',
  },
  fr: {
    found: (name, steamid) => `${name} (${steamid})`,
    public: 'profil public',
    private: 'profil privé : statut seul, jeu invisible',
    notFound: (input) => `${input} : introuvable sur Steam`,
    invalid: (input) => `${input} : ni SteamID, ni URL de profil, ni identifiant personnalisé`,
    unresolved: (input) => `${input} : impossible à vérifier pour l'instant`,
    none: 'Aucun compte saisi.',
  },
  de: {
    found: (name, steamid) => `${name} (${steamid})`,
    public: 'öffentliches Profil',
    private: 'privates Profil: nur Status, Spiel verborgen',
    notFound: (input) => `${input}: auf Steam nicht gefunden`,
    invalid: (input) => `${input}: weder SteamID noch Profil-URL noch eigener Name`,
    unresolved: (input) => `${input}: gerade nicht prüfbar`,
    none: 'Kein Konto eingegeben.',
  },
  es: {
    found: (name, steamid) => `${name} (${steamid})`,
    public: 'perfil público',
    private: 'perfil privado: solo el estado, juego oculto',
    notFound: (input) => `${input}: no encontrado en Steam`,
    invalid: (input) => `${input}: no es un SteamID, una URL de perfil ni un nombre personalizado`,
    unresolved: (input) => `${input}: no se puede comprobar ahora`,
    none: 'Ninguna cuenta introducida.',
  },
};

/**
 * @param {Record<string, string>} texts a multi-language object
 * @param {string} language
 */
export function pick(texts, language) {
  return texts[language] ?? texts.en;
}

/** @param {number} personastate @param {string} language */
export function statusLabel(personastate, language) {
  const key = STATUS_KEYS[personastate] ?? 'online';
  return pick(STATUS_LABELS, language)[key];
}
