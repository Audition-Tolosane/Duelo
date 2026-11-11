"""Catalogue des avatars proposés aux joueurs (choix dans le profil).

Synchronisé au démarrage du serveur : la table `avatars` contient exactement cette liste.
Les images sont dans static/avatars/ (versionnées dans le dépôt, donc jamais effacées par un
déploiement). Retirer un avatar d'ici le retire du choix, mais son fichier reste : les joueurs
qui l'avaient déjà choisi le gardent.

Collection 2 (11/11/2026) : style 3D « pâte à modeler », un homme et une femme par univers.
"""
import logging

from sqlalchemy import select

from models import Avatar

logger = logging.getLogger(__name__)

UNIVERS = ["SCREEN", "SOUND", "ARENA", "LEGENDS", "LAB", "GLOBE", "ART", "LIFE", "MIND"]

CATALOGUE = [
    (f"v2_{u.lower()}_{g}", f"avatars/v2_{u.lower()}_{g}.webp", u)
    for u in UNIVERS for g in ("f", "m")
]


async def sync_avatars(session_factory):
    try:
        async with session_factory() as db:
            rows = (await db.execute(select(Avatar))).scalars().all()
            wanted = {url for _, url, _ in CATALOGUE}
            have = {a.image_url for a in rows}
            removed = 0
            for a in rows:
                if a.image_url not in wanted:
                    await db.delete(a)
                    removed += 1
            added = 0
            for name, url, cat in CATALOGUE:
                if url not in have:
                    db.add(Avatar(name=name, image_url=url, category=cat))
                    added += 1
            await db.commit()
            if added or removed:
                logger.info(f"[avatars] catalogue synchronisé : +{added} / -{removed}")
    except Exception as e:
        logger.warning(f"[avatars] synchronisation impossible : {e}")
