import React from 'react';
import {
  ArrowLeft, Bell, BookOpen, Brain, Check, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleX,
  Clock, Compass, Crown, Film, FlaskConical, Flame, Gamepad2, Gift, Globe, Heart, House, Landmark, Leaf, Lock,
  Medal, MessageCircle, Music, Palette, Plus, RotateCcw, Search, Settings, Share2, ShoppingBag, Sparkles,
  Star, Swords, Target, Timer, Trophy, User, Users, X, Zap, Info, LogOut, Trash2, Shield, Calendar, TrendingUp,
  Camera, Pencil, Send, Hammer, LayoutGrid, Bookmark, CircleHelp, FileText, Languages, Image as ImageIcon, Headphones, Gem, Dumbbell,
  WifiOff, CheckCheck, UserPlus, BellRing, Lightbulb, Moon, SlidersHorizontal, ArrowUp, ArrowRight, Pin,
  UtensilsCrossed, Tv, Sprout, ClipboardList, TriangleAlert, Mail, Eye, EyeOff, Microscope, Inbox, RefreshCw,
} from 'lucide-react-native';
import { COLOR, ICON_SIZE } from '../../theme/tokens';

// Registre FERMÉ des icônes d'interface SKILKI (Lucide, trait 2).
// Ajouter une icône ici plutôt que d'importer une autre bibliothèque dans un écran.
const REGISTRY = {
  back: ArrowLeft, bell: Bell, book: BookOpen, brain: Brain, check: Check, chevronDown: ChevronDown,
  chevronLeft: ChevronLeft, chevronRight: ChevronRight, success: CircleCheck, error: CircleX, clock: Clock,
  compass: Compass, crown: Crown, film: Film, flask: FlaskConical, flame: Flame, gamepad: Gamepad2, gift: Gift,
  globe: Globe, heart: Heart, home: House, landmark: Landmark, leaf: Leaf, lock: Lock, medal: Medal,
  message: MessageCircle, music: Music, palette: Palette, plus: Plus, replay: RotateCcw, search: Search,
  settings: Settings, share: Share2, shop: ShoppingBag, sparkles: Sparkles, star: Star, duel: Swords,
  target: Target, timer: Timer, trophy: Trophy, user: User, users: Users, close: X, bolt: Zap, info: Info,
  logout: LogOut, trash: Trash2, shield: Shield, calendar: Calendar, trend: TrendingUp,
  camera: Camera, edit: Pencil, send: Send, forge: Hammer, grid: LayoutGrid, bookmark: Bookmark, help: CircleHelp,
  document: FileText, language: Languages, image: ImageIcon, support: Headphones, gem: Gem, training: Dumbbell,
  // Lot A (navigation et écrans transversaux)
  offline: WifiOff, readAll: CheckCheck, userPlus: UserPlus, bellRing: BellRing, idea: Lightbulb, moon: Moon,
  sliders: SlidersHorizontal, arrowUp: ArrowUp, arrowRight: ArrowRight, pin: Pin, food: UtensilsCrossed, tv: Tv,
  sprout: Sprout, clipboard: ClipboardList, warning: TriangleAlert, mail: Mail, eye: Eye, eyeOff: EyeOff,
  microscope: Microscope, inbox: Inbox, refresh: RefreshCw,
} as const;

export type IconName = keyof typeof REGISTRY;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function Icon({ name, size = ICON_SIZE.lg, color = COLOR.text.primary, strokeWidth = 2 }: Props) {
  const Cmp = REGISTRY[name];
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} />;
}
