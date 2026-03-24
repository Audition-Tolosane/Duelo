BOT_NAMES = [
    "NeoQuizzer", "BrainStorm_42", "QuizNinja_FR", "Le_Sage_77", "MindBlaster",
    "Trivia_King", "CyberBrain_X", "Le_Savant", "QuizMaster_Pro", "Flash_Quiz",
    "Enigma_99", "Le_Cerveau", "SmartFox_22", "Quiz_Phoenix", "Galaxy_Mind"
]


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


SUPER_CATEGORY_META = {
    "SCREEN": {"icon": "🎬", "color": "#8A2BE2", "label": "Screen"},
    "SOUND": {"icon": "🎵", "color": "#FF6B35", "label": "Sound"},
    "ARENA": {"icon": "⚽", "color": "#00FF9D", "label": "Arena"},
    "LEGENDS": {"icon": "🏛️", "color": "#FFD700", "label": "Legends"},
    "LAB": {"icon": "🔬", "color": "#1565C0", "label": "Lab"},
    "TASTE": {"icon": "🍽️", "color": "#FF69B4", "label": "Taste"},
    "GLOBE": {"icon": "🌍", "color": "#4ECDC4", "label": "Globe"},
    "PIXEL": {"icon": "🎮", "color": "#FF3B5C", "label": "Pixel"},
    "STYLE": {"icon": "✨", "color": "#E040FB", "label": "Style"},
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
    "Combat & Athlé": "🥊",
    "E-sport & Gaming": "🎮",
    "Sports de Balle": "🏀",
    # LEGENDS
    "Antiq. & M-Â": "🏛️",
    "Hist. Moderne": "📜",
    "Mythologies": "⚡",
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

