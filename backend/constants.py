
DIFFICULTY_LEVELS = {
    "debutant": {"min": 0, "max": 5, "label": "Débutant"},
    "intermediaire": {"min": 6, "max": 19, "label": "Intermédiaire"},
    "avance": {"min": 20, "max": 34, "label": "Avancé"},
    "expert": {"min": 35, "max": 50, "label": "Expert"},
}

COUNTRY_FLAGS = {
    "France": "🇫🇷", "Germany": "🇩🇪", "Spain": "🇪🇸", "Italy": "🇮🇹", "United Kingdom": "🇬🇧",
    "United States": "🇺🇸", "Canada": "🇨🇦", "Brazil": "🇧🇷", "Japan": "🇯🇵", "China": "🇨🇳",
    "Australia": "🇦🇺", "India": "🇮🇳", "Mexico": "🇲🇽", "Russia": "🇷🇺", "South Korea": "🇰🇷",
    "Netherlands": "🇳🇱", "Belgium": "🇧🇪", "Switzerland": "🇨🇭", "Portugal": "🇵🇹", "Sweden": "🇸🇪",
    "Norway": "🇳🇴", "Denmark": "🇩🇰", "Finland": "🇫🇮", "Poland": "🇵🇱", "Austria": "🇦🇹",
    "Ireland": "🇮🇪", "Argentina": "🇦🇷", "Colombia": "🇨🇴", "Chile": "🇨🇱", "Morocco": "🇲🇦",
    "Algeria": "🇩🇿", "Tunisia": "🇹🇳", "Egypt": "🇪🇬", "Turkey": "🇹🇷", "Saudi Arabia": "🇸🇦",
    "South Africa": "🇿🇦", "Nigeria": "🇳🇬", "Indonesia": "🇮🇩", "Thailand": "🇹🇭", "Vietnam": "🇻🇳",
    "Philippines": "🇵🇭", "Malaysia": "🇲🇾", "Singapore": "🇸🇬", "New Zealand": "🇳🇿",
    "Israel": "🇮🇱", "Greece": "🇬🇷", "Czech Republic": "🇨🇿", "Romania": "🇷🇴", "Hungary": "🇭🇺",
    "Ukraine": "🇺🇦", "Croatia": "🇭🇷", "Peru": "🇵🇪", "Venezuela": "🇻🇪", "Ecuador": "🇪🇨",
}

NOTIFICATION_TYPE_MAP = {
    "challenge": {"icon": "⚔️", "priority": 1},
    "match_result": {"icon": "🏆", "priority": 2},
    "follow": {"icon": "👤", "priority": 3},
    "message": {"icon": "💬", "priority": 3},
    "like": {"icon": "❤️", "priority": 4},
    "comment": {"icon": "💬", "priority": 4},
    "system": {"icon": "🔔", "priority": 5},
}

TOTAL_QUESTIONS = 7

# « Pour tout le monde » (onglet Thèmes + Quick Match) : thèmes jouables à deux sans œuvre
# ni artiste en commun. D'abord les thèmes écrits exprès pour ça (mode GRAND PUBLIC du
# pipeline de contenu), puis les thèmes larges déjà au catalogue. Un id absent de la base
# ou sans question dans la langue du joueur est simplement ignoré : on peut lister ici un
# thème encore en cours de génération.
GRAND_PUBLIC_THEMES = [
    "GLO_CULTGEN", "GLO_SAVIEZ", "GLO_MARQ", "CIN_CULTES", "STV_CULTES", "ANI_ENFANCE",
    "SOU_TUBES", "ARE_SPORTGEN", "LEG_GDMOM", "LAB_INVENT", "LIF_ANIMAUX", "ART_CHEFS",
    "ART_MODE",
    "GLO_CAPI", "GLO_DRAP", "GLO_MONU", "LAB_VOIT", "SOU_P80S", "SOU_P90S", "ARE_CDM",
    "ARE_OLYM", "LIF_CHIE", "LIF_CHAT", "LIF_DINO", "ANI_DISN", "ANI_PIXA", "GLO_BOLL",
    "LAB_SOLR", "GLO_OCEA", "GLO_MYTH",
]


SUPER_CATEGORY_META = {
    "SCREEN": {"icon": "🎬", "color": "#8A2BE2", "label": "Screen"},
    "SOUND": {"icon": "🎵", "color": "#FF6B35", "label": "Sound"},
    "ARENA": {"icon": "⚽", "color": "#00FF9D", "label": "Arena"},
    "LEGENDS": {"icon": "🏛️", "color": "#FFD700", "label": "Legends"},
    "LAB": {"icon": "🔬", "color": "#1565C0", "label": "Lab"},
    "GLOBE": {"icon": "🌍", "color": "#4ECDC4", "label": "Globe"},
    "ART": {"icon": "🎨", "color": "#E53935", "label": "Art"},
    "LIFE": {"icon": "🌱", "color": "#2E7D32", "label": "Life"},
    "MIND": {"icon": "🧠", "color": "#FFAB40", "label": "Mind"},
}

CLUSTER_ICONS = {
    "Communauté": "⚒",
    # SCREEN
    "Séries TV": "📺",
    "Cinéma": "🎬",
    "Animation & Anime": "🎌",
    # SOUND
    "Hits & Pop Culture": "🎤",
    "Musiques de Films & Jeux": "🎼",
    "Rock & Classiques": "🎸",
    # ARENA
    "Combat & Sports individuels": "🥊",
    "E-sport & Gaming": "🎮",
    "Sports de Balle": "🏀",
    "Sports mécaniques": "🏎️",
    # LEGENDS
    "Antiquité & Moyen Âge": "🏛️",
    "Histoire moderne": "📜",
    "Histoires nationales": "🗺️",
    "Mythes & Religions": "⚡",
    # LAB
    "Espace & Univers": "🚀",
    "Physique & Chimie": "⚗️",
    "Tech & IA": "🤖",
    # GLOBE
    "Gastronomie": "🍷",
    "Langues & Cultures": "🗣️",
    "Voyage & Géo": "✈️",
    # ART
    "Architecture": "🏗️",
    "Mode & Design": "👗",
    "Peinture & Sculpture": "🖌️",
    # LIFE
    "Corps Humain": "🫀",
    "Monde Animal": "🐾",
    "Nature & Écologie": "🌿",
    # MIND
    "Littérature": "📖",
    "Maths & Logique": "🔢",
    "Philo & Psycho": "💭",
}

