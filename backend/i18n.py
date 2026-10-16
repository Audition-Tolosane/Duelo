"""i18n.py — Résolution de la langue affichée : questions et libellés de thèmes.

DEUX SURFACES, DEUX MÉCANISMES DIFFÉRENTS.

  - Les QUESTIONS sont traduites en lignes distinctes (`questions.language`), parce que
    `questions.id` est unique et que le jeu en sert 7 par partie : filtrer une colonne
    est plus simple et plus rapide qu'élargir chaque ligne.

  - Les LIBELLÉS DE THÈME (nom, description, cinq titres de niveau) tiennent dans une
    seule colonne JSON `themes.translations`. Il y a 917 thèmes et sept champs courts :
    créer une table jointe pour ça aurait alourdi une dizaine d'endpoints sans rien
    apporter.

LE FRANÇAIS EST LA LANGUE DE RÉFÉRENCE, ET LE REPLI EST TOUJOURS SILENCIEUX. Le
catalogue se traduit THÈME PAR THÈME : à tout instant certains thèmes existent dans la
langue demandée et d'autres non. Un thème non traduit doit s'afficher en français sans
que rien ne casse — c'est ce qui permet de déployer au fil de l'eau plutôt que d'attendre
que les 100 thèmes soient prêts.
"""

LANGUE_REFERENCE = "fr"
LANGUES_TRADUITES = ("en", "es", "pt", "it", "de")
LANGUES_CONNUES = (LANGUE_REFERENCE,) + LANGUES_TRADUITES

# Champs de `themes` qui portent du texte affiché au joueur, donc traduisibles.
CHAMPS_THEME = ("name", "description",
                "title_lv1", "title_lv10", "title_lv20", "title_lv35", "title_lv50")


def normaliser_langue(lang):
    """'EN', 'en-GB', None -> 'en' / 'fr'. Toute langue inconnue retombe sur le français.

    Le client peut envoyer un code régional ('es-MX') ou rien du tout ; on ne veut ni
    faire échouer la requête, ni servir une langue vide."""
    if not lang:
        return LANGUE_REFERENCE
    court = str(lang).strip().lower().replace("_", "-").split("-")[0]
    return court if court in LANGUES_CONNUES else LANGUE_REFERENCE


def filtre_langue_questions(colonne_langue, lang):
    """Clause SQLAlchemy sélectionnant les questions de `lang`.

    Le français est un cas particulier : les lignes historiques ont language=NULL et
    doivent être incluses. Aucune autre langue n'a ce besoin."""
    from sqlalchemy import or_
    lang = normaliser_langue(lang)
    if lang == LANGUE_REFERENCE:
        return or_(colonne_langue == LANGUE_REFERENCE, colonne_langue.is_(None))
    return colonne_langue == lang


def libelles_theme(theme, lang):
    """-> dict des sept champs affichables du thème, dans `lang`, français en repli.

    Champ par champ : une traduction partielle (nom traduit, titres de niveau pas
    encore) affiche ce qui existe et complète en français, plutôt que de tout perdre."""
    lang = normaliser_langue(lang)
    base = {c: (getattr(theme, c, None) or "") for c in CHAMPS_THEME}
    if lang == LANGUE_REFERENCE:
        return base
    trad = getattr(theme, "translations", None) or {}
    if isinstance(trad, str):                     # colonne JSON lue comme texte brut
        import json
        try:
            trad = json.loads(trad)
        except Exception:
            trad = {}
    pour_langue = (trad.get(lang) or {}) if isinstance(trad, dict) else {}
    return {c: (pour_langue.get(c) or base[c]) for c in CHAMPS_THEME}


# Noms de CLUSTERS (sous-catégories). Ils vivent en clair dans `themes.cluster` (clé française,
# partagée par une vingtaine de thèmes chacun) : une table de correspondance suffit.
# Un cluster absent de la table s'affiche en français (même repli que les thèmes).
CLUSTERS_TRADUITS = {
    "Communauté": {"en": "Community", "es": "Comunidad", "pt": "Comunidade", "it": "Comunità", "de": "Community"},
    # SCREEN
    "Séries TV": {"en": "TV Series", "es": "Series de TV", "pt": "Séries de TV", "it": "Serie TV", "de": "Serien"},
    "Cinéma": {"en": "Movies", "es": "Cine", "pt": "Cinema", "it": "Cinema", "de": "Kino"},
    "Animation & Anime": {"en": "Animation & Anime", "es": "Animación y anime", "pt": "Animação e anime", "it": "Animazione e anime", "de": "Animation & Anime"},
    # SOUND
    "Hits & Pop Culture": {"en": "Hits & Pop Culture", "es": "Éxitos y cultura pop", "pt": "Hits e cultura pop", "it": "Hit e cultura pop", "de": "Hits & Popkultur"},
    "Musiques de Films & Jeux": {"en": "Film & Game Music", "es": "Música de cine y videojuegos", "pt": "Trilhas de filmes e games", "it": "Colonne sonore di film e videogiochi", "de": "Film- & Spielemusik"},
    "Rock & Classiques": {"en": "Rock & Classical", "es": "Rock y clásica", "pt": "Rock e clássica", "it": "Rock e classica", "de": "Rock & Klassik"},
    # ARENA
    "Combat & Sports individuels": {"en": "Combat & Individual Sports", "es": "Combate y deportes individuales", "pt": "Lutas e esportes individuais", "it": "Sport da combattimento e individuali", "de": "Kampf- & Einzelsport"},
    "E-sport & Gaming": {"en": "Esports & Gaming", "es": "Esports y videojuegos", "pt": "eSports e games", "it": "Esport e gaming", "de": "E-Sport & Gaming"},
    "Sports de Balle": {"en": "Ball Sports", "es": "Deportes de pelota", "pt": "Esportes com bola", "it": "Sport con la palla", "de": "Ballsport"},
    "Sports mécaniques": {"en": "Motorsport", "es": "Deportes de motor", "pt": "Automobilismo", "it": "Motorsport", "de": "Motorsport"},
    # LEGENDS
    "Antiquité & Moyen Âge": {"en": "Antiquity & Middle Ages", "es": "Antigüedad y Edad Media", "pt": "Antiguidade e Idade Média", "it": "Antichità e Medioevo", "de": "Antike & Mittelalter"},
    "Histoire moderne": {"en": "Modern History", "es": "Historia moderna", "pt": "História moderna", "it": "Storia moderna", "de": "Neuere Geschichte"},
    "Histoires nationales": {"en": "National Histories", "es": "Historias nacionales", "pt": "Histórias nacionais", "it": "Storie nazionali", "de": "Nationalgeschichte"},
    "Mythes & Religions": {"en": "Myths & Religions", "es": "Mitos y religiones", "pt": "Mitos e religiões", "it": "Miti e religioni", "de": "Mythen & Religionen"},
    # LAB
    "Espace & Univers": {"en": "Space & Universe", "es": "Espacio y universo", "pt": "Espaço e universo", "it": "Spazio e universo", "de": "Weltraum & Universum"},
    "Physique & Chimie": {"en": "Physics & Chemistry", "es": "Física y química", "pt": "Física e química", "it": "Fisica e chimica", "de": "Physik & Chemie"},
    "Tech & IA": {"en": "Tech & AI", "es": "Tecnología e IA", "pt": "Tecnologia e IA", "it": "Tecnologia e IA", "de": "Technik & KI"},
    # GLOBE
    "Gastronomie": {"en": "Gastronomy", "es": "Gastronomía", "pt": "Gastronomia", "it": "Gastronomia", "de": "Gastronomie"},
    "Langues & Cultures": {"en": "Languages & Cultures", "es": "Lenguas y culturas", "pt": "Línguas e culturas", "it": "Lingue e culture", "de": "Sprachen & Kulturen"},
    "Voyage & Géo": {"en": "Travel & Geography", "es": "Viajes y geografía", "pt": "Viagem e geografia", "it": "Viaggi e geografia", "de": "Reisen & Geografie"},
    # ART
    "Architecture": {"en": "Architecture", "es": "Arquitectura", "pt": "Arquitetura", "it": "Architettura", "de": "Architektur"},
    "Mode & Design": {"en": "Fashion & Design", "es": "Moda y diseño", "pt": "Moda e design", "it": "Moda e design", "de": "Mode & Design"},
    "Peinture & Sculpture": {"en": "Painting & Sculpture", "es": "Pintura y escultura", "pt": "Pintura e escultura", "it": "Pittura e scultura", "de": "Malerei & Skulptur"},
    # LIFE
    "Corps Humain": {"en": "Human Body", "es": "Cuerpo humano", "pt": "Corpo humano", "it": "Corpo umano", "de": "Menschlicher Körper"},
    "Monde Animal": {"en": "Animal Kingdom", "es": "Mundo animal", "pt": "Mundo animal", "it": "Mondo animale", "de": "Tierwelt"},
    "Nature & Écologie": {"en": "Nature & Ecology", "es": "Naturaleza y ecología", "pt": "Natureza e ecologia", "it": "Natura ed ecologia", "de": "Natur & Ökologie"},
    # MIND
    "Littérature": {"en": "Literature", "es": "Literatura", "pt": "Literatura", "it": "Letteratura", "de": "Literatur"},
    "Maths & Logique": {"en": "Math & Logic", "es": "Matemáticas y lógica", "pt": "Matemática e lógica", "it": "Matematica e logica", "de": "Mathe & Logik"},
    "Philo & Psycho": {"en": "Philosophy & Psychology", "es": "Filosofía y psicología", "pt": "Filosofia e psicologia", "it": "Filosofia e psicologia", "de": "Philosophie & Psychologie"},
}


def nom_cluster(cluster, lang):
    """Nom AFFICHÉ d'un cluster dans `lang`, français en repli. La clé française reste celle
    des requêtes et des regroupements : ne traduire qu'au moment de sérialiser."""
    lang = normaliser_langue(lang)
    if not cluster or lang == LANGUE_REFERENCE:
        return cluster or ""
    return (CLUSTERS_TRADUITS.get(cluster) or {}).get(lang) or cluster


def nom_theme(theme, lang):
    """Raccourci pour le seul champ demandé partout : le nom affiché."""
    return libelles_theme(theme, lang)["name"]


def theme_localise(theme, lang):
    """-> une VUE du thème dont les sept champs texte sont dans `lang`.

    Pourquoi une vue plutôt qu'un dict : `services/xp.get_theme_title()` et
    `get_theme_unlocked_titles()` lisent `theme.title_lv1`, `theme.title_lv10`… par
    attribut. Leur passer cette vue les localise sans toucher une ligne de leur code, et
    sans risquer d'oublier un seuil.

    L'objet n'est PAS un modèle SQLAlchemy et n'est jamais réécrit en base : c'est un
    porteur de champs jetable, destiné au seul affichage."""
    from types import SimpleNamespace
    lib = libelles_theme(theme, lang)
    vue = SimpleNamespace(**lib)
    # Les champs non traduisibles (id, couleur, icône…) restent accessibles tels quels.
    for attr in ("id", "super_category", "cluster", "color_hex", "icon_url", "question_count"):
        setattr(vue, attr, getattr(theme, attr, None))
    return vue
