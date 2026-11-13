"""Géographie des joueurs : ville officielle (OpenStreetMap) et classement local « en cascade ».

Ville : le joueur tape sa ville, le serveur la cherche dans OpenStreetMap (Nominatim) et garde le
NOM OFFICIEL de la commune (« toulouse » → « Toulouse »), son département, sa région, son pays,
son continent et sa position. Une ville introuvable est refusée : plus de classements coupés en
deux par une faute de frappe.

Classement local (onglet « Ville ») : il faut au moins MIN_AREA_PLAYERS joueurs pour qu'un
classement existe. Sinon le joueur est placé, dans l'ordre :
  1. dans sa commune ;
  2. dans la commune la plus proche de SON département qui a assez de joueurs ;
  3. dans son département ;
  4. dans sa région ;
  5. dans son pays ;
  6. sur son continent ;
  7. dans le classement mondial.

Département : le « county » d'OpenStreetMap (Haute-Garonne, Landkreis Freising…). Une ville
sans county est une ville-département : Paris, ou une kreisfreie Stadt allemande comme Munich
ou Augsburg — elle est alors son propre département. Région : le « state » (Occitanie, Bayern).
"""
import asyncio
import logging
import time
from math import radians, sin, cos, sqrt, atan2

import httpx

logger = logging.getLogger(__name__)

MIN_AREA_PLAYERS = 20
CITY_MIN_PLAYERS = MIN_AREA_PLAYERS   # ancien nom, gardé pour les imports existants
CITY_CHANGE_DAYS = 30                 # un changement de ville tous les 30 jours (le 1er choix est libre)


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in km between two GPS points."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


_CONTINENT_CODES = {
    "Europe": "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI "
              "LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK",
    "Asia": "AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO "
            "MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE",
    "Africa": "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG "
              "ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
    "North America": "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ "
                     "MS MX NI PA PM PR SV SX TC TT US VC VG VI",
    "South America": "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
    "Oceania": "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
    "Antarctica": "AQ BV GS HM TF",
}
CONTINENT_BY_CODE = {code: name for name, codes in _CONTINENT_CODES.items() for code in codes.split()}

_PLACE_TYPES = {"city", "town", "village", "hamlet", "municipality", "suburb", "borough", "quarter"}

# Langue des noms renvoyés : la langue principale du pays (« Bruxelles » et pas « Bruxelles -
# Brussel », « Casablanca » sans ses deux autres écritures), l'anglais à défaut. Tous les joueurs
# d'une même ville reçoivent ainsi exactement le même nom.
_LANG_BY_CODE = {}
for _lang, _codes in {
    "fr": "FR BE CH LU MC MA DZ TN SN CI CM ML BF NE TG BJ GA CG CD MG HT RE GP MQ GF YT NC PF",
    "es": "ES MX AR CO CL PE VE EC BO PY UY CR PA DO GT HN SV NI CU PR",
    "de": "DE AT LI", "it": "IT SM VA", "pt": "PT BR AO MZ CV", "pl": "PL",
    "ar": "SA EG AE QA KW BH OM JO LB SY IQ YE LY SD", "ja": "JP", "ko": "KR", "zh": "CN TW HK MO SG",
}.items():
    for _c in _codes.split():
        _LANG_BY_CODE[_c] = _lang

# Villes-provinces (Tokyo, Shanghai, Mexico…) : OpenStreetMap les range en « province »/« state »
_CITY_STATE_TYPES = {"province", "state", "city", "town"}

# Nominatim : 1 requête par seconde au plus (règle d'usage d'OpenStreetMap)
_NOMINATIM_LOCK = asyncio.Lock()
_last_call = 0.0


async def _nominatim(params: dict, lang: str) -> list:
    global _last_call
    async with _NOMINATIM_LOCK:
        wait = 1.1 - (time.monotonic() - _last_call)
        if wait > 0:
            await asyncio.sleep(wait)
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={"format": "jsonv2", "addressdetails": 1, **params},
                    headers={"User-Agent": "DueloApp/1.0 (skilki)", "Accept-Language": f"{lang},en"},
                )
                return resp.json() if resp.status_code == 200 else []
        finally:
            _last_call = time.monotonic()


def _norm(s: str) -> str:
    """« Saint-Lys » = « saint lys » = « SAINT LYS » ; « Montréal » = « montreal »."""
    import unicodedata
    s = unicodedata.normalize("NFKD", s or "").lower()
    return "".join(c for c in s if c.isalnum() and not unicodedata.combining(c))


def _matches(hit: dict, q: str) -> bool:
    """Un des noms du lieu (nom local, name:en, name:fr, ancien nom…) commence par le texte tapé,
    ou l'inverse (« 京都 » / « 京都市 », « Tokyo » / « Tokyo-to »)."""
    names = [hit.get("name") or ""] + list((hit.get("namedetails") or {}).values())
    for n in names:
        n = _norm(n)
        if n and q and (n.startswith(q) or q.startswith(n)):
            return True
    return False


async def resolve_place(city: str, country: str) -> dict | None:
    """Commune officielle pour « ville, pays », ou None si introuvable. Lève une exception si le
    service est injoignable."""
    city, country = (city or "").strip(), (country or "").strip()
    if not city:
        return None
    from helpers import _code_to_country
    by_name = {v.lower(): k for k, v in _code_to_country().items()}
    cc = by_name.get(country.lower()) or (country.upper() if len(country) == 2 else "")
    lang = _LANG_BY_CODE.get(cc, "en")
    # Pays connu : filtre par code pays (une ville tapée en japonais est trouvée même si le pays
    # est écrit en anglais) ; sinon recherche « ville, pays » en texte libre.
    base = {"q": city, "countrycodes": cc.lower()} if cc else {"q": f"{city}, {country}" if country else city}
    q = _norm(city)
    try:
        data = await _nominatim({**base, "limit": 5, "featureType": "settlement", "namedetails": 1}, lang)
        # Le lieu dont un nom officiel (toutes langues) correspond à ce qui a été tapé, sinon le 1er
        hit = next((h for h in data if _matches(h, q)), data[0] if data else None)
        if not hit:
            # 2e essai : villes-provinces (Tokyo, Shanghai, Mexico), absentes du filtre « settlement ».
            # Nom obligatoirement correspondant : sans ça, « 京都 » (Kyoto) donnait « 東京都 » (Tokyo).
            data = await _nominatim({**base, "limit": 5, "namedetails": 1}, lang)
            hit = next((h for h in data if h.get("addresstype") in _CITY_STATE_TYPES and _matches(h, q)), None)
    except Exception as e:
        logger.warning(f"[geo] Nominatim indisponible pour '{city}, {country}': {e}")
        raise
    if not hit:
        return None
    addr = hit.get("address") or {}
    # Le lieu trouvé lui-même (Bibury), pas l'ensemble qui le contient (« city »: Cotswold)
    if hit.get("addresstype") in _PLACE_TYPES | _CITY_STATE_TYPES and hit.get("name"):
        name = hit["name"]
    else:
        name = (addr.get("city") or addr.get("town") or addr.get("village") or addr.get("hamlet")
                or addr.get("municipality") or addr.get("suburb"))
    if not name:
        return None
    code = str(addr.get("country_code") or "").upper()
    city_state = hit.get("addresstype") in ("province", "state")
    return {
        "city": name[:100],
        # Pas de county : ville-département (Paris, Munich…) → la ville elle-même
        "department": (addr.get("county") or addr.get("state_district") or name)[:100],
        # Région : « state » (Occitanie, Bayern) ; l'Italie la range sous « region » (Lombardia).
        # Pas de « region » en France : c'est « France métropolitaine », d'où state d'abord.
        # Ville-province (Tokyo) : pas de région au-dessus d'elle.
        "region": None if city_state else
                  ((addr.get("state") or addr.get("province")          # province : préfecture japonaise (大阪府)
                    or (addr.get("region") if code != "FR" else None) or "")[:100] or None),
        "country": _code_to_country().get(code) or (addr.get("country") or country)[:100],
        "continent": CONTINENT_BY_CODE.get(code),
        "lat": float(hit["lat"]), "lng": float(hit["lon"]),
    }


async def pick_area(user, count, cities_in_department) -> dict:
    """Classement local du joueur, du plus petit au plus grand, selon la règle en tête du fichier.

    count(filters) -> nombre de joueurs classés avec ces filtres (liste de conditions SQLAlchemy).
    cities_in_department(filters) -> [(ville, nb, lat_moy, lng_moy)] des communes du département.
    Renvoie {"level", "name", "filters"} (filtres à appliquer à la requête du classement)."""
    from models import User
    levels = []
    if user.city and user.country:
        levels.append(("city", user.city, [User.country == user.country, User.city == user.city]))
    for level, name, filters in levels:
        if await count(filters) >= MIN_AREA_PLAYERS:
            return {"level": level, "name": name, "filters": filters}

    if user.department and user.country:
        dep_filters = [User.country == user.country, User.department == user.department]
        rows = [r for r in await cities_in_department(dep_filters)
                if r[0] != user.city and r[1] >= MIN_AREA_PLAYERS]
        if rows:
            if user.lat is not None and user.lng is not None:
                rows.sort(key=lambda r: haversine(user.lat, user.lng, r[2], r[3])
                          if r[2] is not None and r[3] is not None else 1e9)
            else:
                rows.sort(key=lambda r: -r[1])
            city = rows[0][0]
            return {"level": "nearby_city", "name": city, "filters": dep_filters + [User.city == city]}
        if await count(dep_filters) >= MIN_AREA_PLAYERS:
            return {"level": "department", "name": user.department, "filters": dep_filters}

    if user.region and user.country:
        reg_filters = [User.country == user.country, User.region == user.region]
        if await count(reg_filters) >= MIN_AREA_PLAYERS:
            return {"level": "region", "name": user.region, "filters": reg_filters}

    if user.country and await count([User.country == user.country]) >= MIN_AREA_PLAYERS:
        return {"level": "country", "name": user.country, "filters": [User.country == user.country]}
    if user.continent and await count([User.continent == user.continent]) >= MIN_AREA_PLAYERS:
        return {"level": "continent", "name": user.continent, "filters": [User.continent == user.continent]}
    return {"level": "world", "name": "", "filters": []}
