import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, TextInput,
  Alert, ActivityIndicator, Platform, KeyboardAvoidingView, RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Papa from 'papaparse';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/** Authenticated admin fetch — sends password in X-Admin-Key header, never in body. */
const adminFetch = (url: string, adminPassword: string, options: RequestInit = {}): Promise<Response> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Admin-Key': adminPassword,
    ...(options.headers as Record<string, string> ?? {}),
  };
  return fetch(url, { ...options, headers });
};

type QuestionRow = {
  id?: string;
  category: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  difficulty?: string;
  angle?: string;
  angle_num?: string;
  batch?: string;
};

type ImportResult = {
  success: boolean;
  imported: number;
  duplicates: number;
  errors: string[];
  total_processed: number;
};

type ThemeItem = {
  id: string;
  name: string;
  description: string;
  question_count: number;
  color_hex: string;
};

type ClusterItem = {
  name: string;
  icon: string;
  themes: ThemeItem[];
  total_questions: number;
};

type SuperCategoryItem = {
  id: string;
  label: string;
  icon: string;
  color: string;
  clusters: ClusterItem[];
  total_themes: number;
  total_questions: number;
};

type ThemesOverview = {
  super_categories: SuperCategoryItem[];
  totals: {
    super_categories: number;
    clusters: number;
    themes: number;
    questions: number;
  };
};

type MatchStat = {
  theme_id: string;
  theme_name: string;
  match_count: number;
};

type ReportItem = {
  id: string;
  user_id: string;
  user_pseudo: string;
  question_id: string;
  question_text: string;
  category: string;
  reason_type: string;
  description: string;
  status: string;
  created_at: string;
};

type ReportCounts = {
  pending: number;
  reviewed: number;
  resolved: number;
  total: number;
};

const TABS = ['Questions', 'Themes', 'Stats', 'Signalements', 'Avatars'];

const TAB_ICONS: Record<string, string> = {
  Questions: 'file-document-outline',
  Themes: 'palette-outline',
  Stats: 'chart-bar',
  Signalements: 'alert-circle-outline',
  Avatars: 'account-circle-outline',
};

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web') { window.alert(`${title}: ${msg}`); }
  else { Alert.alert(title, msg); }
};

const REASON_LABELS: Record<string, string> = {
  wrong_answer: 'Mauvaise reponse',
  unclear_question: 'Question pas claire',
  typo: 'Faute / erreur',
  outdated: 'Info obsolete',
  other: 'Autre',
};

const STATUS_COLORS: Record<string, string> = {
  pending: '#FFA500',
  reviewed: '#00BFFF',
  resolved: '#00C853',
};

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState(0);

  // Questions CSV state
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<QuestionRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Themes state
  const [themesOverview, setThemesOverview] = useState<ThemesOverview | null>(null);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [themesFileName, setThemesFileName] = useState('');
  const [themesCSVText, setThemesCSVText] = useState('');
  const [themesPreviewCount, setThemesPreviewCount] = useState(0);
  const [uploadingThemes, setUploadingThemes] = useState(false);
  const [themesUploadResult, setThemesUploadResult] = useState<any>(null);
  const [expandedSC, setExpandedSC] = useState<string | null>(null);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Theme selection for deletion
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [deletingThemes, setDeletingThemes] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Stats state
  const [matchStats, setMatchStats] = useState<MatchStat[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loadingMatchStats, setLoadingMatchStats] = useState(false);

  // Reports state
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportCounts, setReportCounts] = useState<ReportCounts>({ pending: 0, reviewed: 0, resolved: 0, total: 0 });
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportFilter, setReportFilter] = useState<string>('');

  // Avatar states
  const [avatars, setAvatars] = useState<{id: string; name: string; image_url: string; category: string}[]>([]);
  const [avatarCategory, setAvatarCategory] = useState('default');
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loadingAvatars, setLoadingAvatars] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated && password) {
      loadThemesOverview(password);
      loadMatchStats(password);
      loadReports(password);
    }
  }, [isAuthenticated, password]);

  // ── Loaders ──

  const loadThemesOverview = async (pwd = password) => {
    setLoadingThemes(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/themes-overview`, pwd);
      const data = await res.json();
      setThemesOverview(data);
    } catch (e) {
      console.error('Error loading themes:', e);
    } finally {
      setLoadingThemes(false);
    }
  };

  const loadMatchStats = async (pwd = password) => {
    setLoadingMatchStats(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/match-stats-by-theme`, pwd);
      const data = await res.json();
      setMatchStats(data.stats || []);
      setTotalMatches(data.total_matches || 0);
    } catch (e) {
      console.error('Error loading match stats:', e);
    } finally {
      setLoadingMatchStats(false);
    }
  };

  const loadReports = async (pwd = password) => {
    setLoadingReports(true);
    try {
      const url = reportFilter
        ? `${API_URL}/api/admin/reports?status=${reportFilter}`
        : `${API_URL}/api/admin/reports`;
      const res = await adminFetch(url, pwd);
      const data = await res.json();
      setReports(data.reports || []);
      setReportCounts(data.counts || { pending: 0, reviewed: 0, resolved: 0, total: 0 });
    } catch (e) {
      console.error('Error loading reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 0) { /* Questions tab - nothing to refresh */ }
    else if (activeTab === 1) await loadThemesOverview();
    else if (activeTab === 2) await loadMatchStats();
    else if (activeTab === 3) await loadReports();
    else if (activeTab === 4) await fetchAvatars();
    setRefreshing(false);
  }, [activeTab, reportFilter]);

  // ── Auth ──

  const handleLogin = async () => {
    if (!password.trim()) return;
    setAuthLoading(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/verify`, password.trim(), {
        method: 'POST',
        body: JSON.stringify({ password: password.trim() }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        showAlert('Erreur', 'Mot de passe incorrect');
      }
    } catch (e) {
      showAlert('Erreur', 'Impossible de se connecter au serveur');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Web file picker helper ──

  const pickFileWeb = (accept: string): Promise<{ name: string; text: string } | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({ name: file.name, text: reader.result as string });
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });
  };

  // ── Questions CSV ──

  const pickCSVFile = async () => {
    try {
      if (Platform.OS === 'web') {
        const picked = await pickFileWeb('.csv,.txt');
        if (!picked) return;
        setFileName(picked.name);
        setImportResult(null);
        setParseErrors([]);
        setParsedRows([]);
        setCsvColumns([]);
        parseCSV(picked.text);
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setFileName(file.name);
      setImportResult(null);
      setParseErrors([]);
      setParsedRows([]);
      setCsvColumns([]);
      const csvText = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      parseCSV(csvText);
    } catch (e: any) {
      showAlert('Erreur', `Impossible de lire le fichier: ${e.message || e}`);
    }
  };

  const parseCSV = (csvText: string) => {
    const errors: string[] = [];
    const validRows: QuestionRow[] = [];

    // Map French column names to internal names
    const COLUMN_MAP: Record<string, string> = {
      'id': 'id', 'id_question': 'id',
      'catégorie': 'category', 'categorie': 'category', 'category': 'category',
      'id_theme': 'category', 'theme': 'category', 'theme_id': 'category',
      'question': 'question_text', 'question_text': 'question_text',
      'rep_a': 'option_a', 'option_a': 'option_a',
      'rep_b': 'option_b', 'option_b': 'option_b',
      'rep_c': 'option_c', 'option_c': 'option_c',
      'rep_d': 'option_d', 'option_d': 'option_d',
      'bonne_rep': 'correct_option', 'correct_option': 'correct_option',
      'difficulté': 'difficulty', 'difficulte': 'difficulty', 'difficulty': 'difficulty',
      'angle': 'angle',
      'angle_num': 'angle_num', 'angle num': 'angle_num',
      'batch': 'batch',
    };

    // Auto-detect delimiter
    const firstLine = csvText.split('\n')[0] || '';
    const delim = firstLine.includes(';') ? ';' : firstLine.includes('\t') ? '\t' : ',';

    const parsed = Papa.parse(csvText, {
      delimiter: delim,
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        const normalized = header.trim().toLowerCase().replace(/\s+/g, '_');
        return COLUMN_MAP[normalized] || normalized;
      },
    });
    if (parsed.errors && parsed.errors.length > 0) {
      parsed.errors.forEach((err: any) => {
        errors.push(`Ligne ${err.row !== undefined ? err.row + 2 : '?'}: ${err.message}`);
      });
    }
    const fields = parsed.meta?.fields || [];
    setCsvColumns(fields);
    const requiredCols = ['category', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option'];
    const missingCols = requiredCols.filter(col => !fields.includes(col));
    if (missingCols.length > 0) {
      errors.push(`Colonnes manquantes: ${missingCols.join(', ')}`);
      setParseErrors(errors);
      return;
    }
    (parsed.data as any[]).forEach((row: any, index: number) => {
      try {
        const questionText = (row.question_text || '').trim();
        const category = (row.category || '').trim();
        const optA = (row.option_a || '').trim();
        const optB = (row.option_b || '').trim();
        const optC = (row.option_c || '').trim();
        const optD = (row.option_d || '').trim();
        const correct = (row.correct_option || '').trim().toUpperCase();
        if (!questionText) { errors.push(`Ligne ${index + 2}: question_text vide`); return; }
        if (!category) { errors.push(`Ligne ${index + 2}: category vide`); return; }
        if (!optA || !optB || !optC || !optD) { errors.push(`Ligne ${index + 2}: option(s) manquante(s)`); return; }
        if (!['A', 'B', 'C', 'D'].includes(correct)) { errors.push(`Ligne ${index + 2}: correct_option invalide`); return; }
        validRows.push({
          id: (row.id || '').trim() || undefined,
          category, question_text: questionText,
          option_a: optA, option_b: optB, option_c: optC, option_d: optD,
          correct_option: correct, difficulty: (row.difficulty || 'medium').trim(),
          angle: (row.angle || '').trim(), angle_num: (row.angle_num || '').trim(),
          batch: (row.batch || '').trim(),
        });
      } catch (e: any) {
        errors.push(`Ligne ${index + 2}: ${e.message || 'erreur inconnue'}`);
      }
    });
    setParsedRows(validRows);
    setParseErrors(errors);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) {
      showAlert('Erreur', 'Aucune question valide');
      return;
    }
    if (Platform.OS === 'web') {
      if (window.confirm(`Importer ${parsedRows.length} questions ?`)) doImport();
    } else {
      Alert.alert('Confirmer', `Importer ${parsedRows.length} questions ?`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Importer', onPress: doImport },
      ]);
    }
  };

  const doImport = async () => {
    setImporting(true);
    setImportResult(null);
    setImportProgress(0);

    const BATCH_SIZE = 2000;
    const totalBatches = Math.ceil(parsedRows.length / BATCH_SIZE);
    let totalImported = 0;
    let totalDuplicates = 0;
    let totalErrors: string[] = [];

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = parsedRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const res = await adminFetch(`${API_URL}/api/admin/upload-csv`, password, {
          method: 'POST',
          body: JSON.stringify({ questions: batch }),
        });
        const data = await res.json();
        if (!res.ok) {
          showAlert('Erreur', data.detail || `Erreur lot ${i + 1}/${totalBatches}`);
          break;
        }
        totalImported += data.imported || 0;
        totalDuplicates += data.duplicates || 0;
        if (data.errors) totalErrors.push(...data.errors);
        setImportProgress(Math.round(((i + 1) / totalBatches) * 100));
      }
      setImportResult({
        success: true, imported: totalImported,
        duplicates: totalDuplicates, errors: totalErrors,
      } as ImportResult);
      loadThemesOverview();
    } catch (e: any) {
      showAlert('Erreur', `Erreur reseau: ${e.message || e}`);
    } finally {
      setImporting(false);
    }
  };

  const resetCSV = () => {
    setFileName(''); setParsedRows([]); setParseErrors([]); setCsvColumns([]); setImportResult(null); setImportProgress(0);
  };

  // ── Themes CSV ──

  const pickThemesCSV = async () => {
    try {
      if (Platform.OS === 'web') {
        const picked = await pickFileWeb('.csv,.txt');
        if (!picked) return;
        setThemesFileName(picked.name);
        setThemesUploadResult(null);
        setThemesCSVText(picked.text);
        const lines = picked.text.split('\n').filter(l => l.trim().length > 0);
        setThemesPreviewCount(Math.max(0, lines.length - 1));
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setThemesFileName(file.name);
      setThemesUploadResult(null);
      const csvText = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      setThemesCSVText(csvText);
      const lines = csvText.split('\n').filter(l => l.trim().length > 0);
      setThemesPreviewCount(Math.max(0, lines.length - 1));
    } catch (e: any) {
      showAlert('Erreur', `Impossible de lire le fichier: ${e.message || e}`);
    }
  };

  const uploadThemesCSV = async () => {
    if (!themesCSVText.trim()) return;
    if (Platform.OS === 'web') {
      if (window.confirm(`Import de ${themesPreviewCount} themes. Les themes existants seront mis à jour, les nouveaux seront ajoutés. Aucune suppression. Continuer ?`)) {
        doUploadThemes();
      }
    } else {
      Alert.alert(
        "Confirmer l'import",
        `Import de ${themesPreviewCount} themes. Les themes existants seront mis à jour, les nouveaux seront ajoutés. Aucune suppression. Continuer ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Importer', onPress: doUploadThemes },
        ],
      );
    }
  };

  const doUploadThemes = async () => {
    setUploadingThemes(true);
    setThemesUploadResult(null);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/upload-themes-csv`, password, {
        method: 'POST',
        body: JSON.stringify({ themes_csv: themesCSVText }),
      });
      const data = await res.json();
      // dev-only log removed from prod build
      if (res.ok) {
        setThemesUploadResult(data);
        loadThemesOverview();
      } else {
        showAlert('Erreur', data.detail || 'Erreur lors de l\'upload');
      }
    } catch (e: any) {
      showAlert('Erreur', `Erreur reseau: ${e.message || e}`);
    } finally {
      setUploadingThemes(false);
    }
  };

  const resetThemesCSV = () => {
    setThemesFileName(''); setThemesCSVText(''); setThemesPreviewCount(0); setThemesUploadResult(null);
  };

  // ── Theme selection & deletion ──

  const toggleThemeSelection = (themeId: string) => {
    setSelectedThemes(prev => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  };

  const toggleClusterSelection = (themes: ThemeItem[]) => {
    const ids = themes.map(t => t.id);
    const allSelected = ids.every(id => selectedThemes.has(id));
    setSelectedThemes(prev => {
      const next = new Set(prev);
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleDeleteThemes = () => {
    if (selectedThemes.size === 0) return;
    setConfirmDelete(true);
  };

  const cancelDelete = () => {
    setConfirmDelete(false);
  };

  const doDeleteThemes = async () => {
    setConfirmDelete(false);
    setDeletingThemes(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/delete-themes`, password, {
        method: 'POST',
        body: JSON.stringify({
          theme_ids: Array.from(selectedThemes),
          delete_questions: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedThemes(new Set());
        loadThemesOverview();
      }
    } catch (e: any) {
      // silently fail
    } finally {
      setDeletingThemes(false);
    }
  };

  // ── Report status update ──

  const updateReportStatus = async (reportId: string, newStatus: string) => {
    try {
      await adminFetch(`${API_URL}/api/admin/reports/${reportId}/status`, password, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      loadReports();
    } catch (e) {
      showAlert('Erreur', 'Impossible de mettre a jour le status');
    }
  };

  // ── Avatars ──

  const fetchAvatars = async () => {
    setLoadingAvatars(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/avatars`, password);
      const data = await res.json();
      setAvatars(data.avatars || []);
    } catch (e) { console.error(e); }
    setLoadingAvatars(false);
  };

  const pickAvatarImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAvatarImage(result.assets[0].base64);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarImage) {
      showAlert('Erreur', 'Image requise');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await adminFetch(`${API_URL}/api/admin/avatars/upload`, password, {
        method: 'POST',
        body: JSON.stringify({
          category: avatarCategory.trim() || 'default',
          image_base64: avatarImage,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showAlert('Succes', 'Avatar uploade');
        setAvatarCategory('default');
        setAvatarImage(null);
        fetchAvatars();
      } else {
        showAlert('Erreur', data.detail || 'Echec upload');
      }
    } catch (e: any) {
      showAlert('Erreur', e.message);
    }
    setUploadingAvatar(false);
  };

  const deleteAvatar = async (avatarId: string) => {
    try {
      const res = await adminFetch(`${API_URL}/api/admin/avatars/${avatarId}`, password, {
        method: 'DELETE',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        fetchAvatars();
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (activeTab === 4) fetchAvatars();
  }, [activeTab]);

  // ── Section Header with gradient ──
  const SectionHeader = ({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) => (
    <View style={styles.sectionHeaderWrap}>
      <LinearGradient
        colors={['rgba(138,43,226,0.25)', 'rgba(138,43,226,0.0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.sectionHeaderGradient}
      >
        <MaterialCommunityIcons name={icon as any} size={20} color="#A855F7" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardDescSub}>{subtitle}</Text> : null}
        </View>
      </LinearGradient>
    </View>
  );

  // ── Auth Screen ──
  if (!isAuthenticated) {
    return (
      <View style={styles.opaqueWrapper} testID="admin-bg" nativeID="admin-bg">
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
            <View style={styles.authContainer}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <MaterialCommunityIcons name="arrow-left" size={16} color="#A855F7" style={{ marginRight: 6 }} />
                <Text style={styles.backBtnText}>Retour</Text>
              </TouchableOpacity>
              <View style={styles.authCard}>
                <LinearGradient
                  colors={['rgba(138,43,226,0.2)', 'rgba(138,43,226,0.05)']}
                  style={styles.authIconWrap}
                >
                  <MaterialCommunityIcons name="lock-outline" size={36} color="#A855F7" />
                </LinearGradient>
                <Text style={styles.authTitle}>Administration</Text>
                <Text style={styles.authSubtitle}>Panel d'administration Duelo</Text>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Mot de passe admin"
                  placeholderTextColor="#555"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  onSubmitEditing={handleLogin}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={[styles.loginBtnWrap, !password.trim() && styles.loginBtnDisabled]}
                  onPress={handleLogin}
                  disabled={!password.trim() || authLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#8A2BE2', '#6A1FB0']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.loginBtnGradient}
                  >
                    {authLoading ? <ActivityIndicator color="#FFF" /> : (
                      <>
                        <MaterialCommunityIcons name="login" size={18} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.loginBtnText}>Se connecter</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    );
  }

  // ── Tab Content Renderers ──

  const renderQuestionsTab = () => (
    <View>
      {/* Upload Section */}
      <View style={styles.card}>
        <SectionHeader icon="folder-upload" title="Importer des questions CSV" />
        <Text style={styles.cardDesc}>
          Format (separateur ;) : ID;Categorie;Question;Rep A;Rep B;Rep C;Rep D;Bonne rep;Difficulte;Angle;Angle Num
        </Text>
        {!fileName ? (
          <TouchableOpacity style={styles.uploadBtn} onPress={pickCSVFile} activeOpacity={0.7}>
            <MaterialCommunityIcons name="folder-upload-outline" size={32} color="#8A2BE2" style={{ marginBottom: 8 }} />
            <Text style={styles.uploadBtnText}>Choisir un fichier CSV</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.fileInfo}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#A855F7" style={{ marginRight: 12 }} />
              <View style={styles.fileDetails}>
                <Text style={styles.fileNameText} numberOfLines={1}>{fileName}</Text>
                <Text style={styles.fileMetaText}>
                  {parsedRows.length} questions valides
                  {parseErrors.length > 0 ? ` | ${parseErrors.length} erreur(s)` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.resetBtn} onPress={resetCSV}>
                <MaterialCommunityIcons name="close" size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            {csvColumns.length > 0 && (
              <View style={styles.columnsInfo}>
                <Text style={styles.columnsTitle}>Colonnes detectees :</Text>
                <Text style={styles.columnsText}>{csvColumns.join(', ')}</Text>
              </View>
            )}
            {parsedRows.length > 0 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>Apercu ({Math.min(3, parsedRows.length)} premieres) :</Text>
                {parsedRows.slice(0, 3).map((row, i) => (
                  <View key={i} style={styles.previewCard}>
                    <Text style={styles.previewCategory}>{row.category}</Text>
                    <Text style={styles.previewQuestion} numberOfLines={2}>{row.question_text}</Text>
                  </View>
                ))}
              </View>
            )}
            {parseErrors.length > 0 && (
              <View style={styles.errorsSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="alert" size={16} color="#FF8A80" style={{ marginRight: 6 }} />
                  <Text style={styles.errorsTitle}>Avertissements ({parseErrors.length}) :</Text>
                </View>
                {parseErrors.slice(0, 10).map((err, i) => (
                  <Text key={i} style={styles.errorText}>{err}</Text>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.importBtnWrap, (parsedRows.length === 0 || importing) && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={parsedRows.length === 0 || importing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={importing ? ['#388E3C', '#2E7D32'] : ['#00C853', '#00A844']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.importBtnGradient}
              >
                {importing ? (
                  <View style={{ width: '100%' }}>
                    <View style={styles.importingRow}>
                      <ActivityIndicator color="#FFF" />
                      <Text style={styles.importBtnText}> {importProgress}% — Lot {Math.ceil((importProgress / 100) * Math.ceil(parsedRows.length / 2000))}/{Math.ceil(parsedRows.length / 2000)}</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 8 }}>
                      <View style={{ height: 4, backgroundColor: '#B9F6CA', borderRadius: 2, width: `${importProgress}%` }} />
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="upload" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.importBtnText}>Importer {parsedRows.length} question{parsedRows.length > 1 ? 's' : ''}</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {importResult && (
        <View style={[styles.card, styles.resultCard]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MaterialCommunityIcons
              name={importResult.success ? 'check-circle' : 'alert-circle'}
              size={22}
              color={importResult.success ? '#00C853' : '#FF3B30'}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.resultTitle}>
              {importResult.success ? 'Importation terminee' : 'Erreur'}
            </Text>
          </View>
          <View style={styles.resultStats}>
            <View style={styles.resultStatCard}>
              <LinearGradient
                colors={['rgba(0,200,83,0.15)', 'rgba(0,200,83,0.03)']}
                style={styles.resultStatGradient}
              >
                <MaterialCommunityIcons name="check" size={18} color="#00C853" />
                <Text style={styles.resultStatNum}>{importResult.imported}</Text>
                <Text style={styles.resultStatLabel}>importees</Text>
              </LinearGradient>
            </View>
            <View style={styles.resultStatCard}>
              <LinearGradient
                colors={['rgba(255,160,0,0.15)', 'rgba(255,160,0,0.03)']}
                style={styles.resultStatGradient}
              >
                <MaterialCommunityIcons name="content-copy" size={18} color="#FFA000" />
                <Text style={[styles.resultStatNum, { color: '#FFA000' }]}>{importResult.duplicates}</Text>
                <Text style={styles.resultStatLabel}>doublons</Text>
              </LinearGradient>
            </View>
            <View style={styles.resultStatCard}>
              <LinearGradient
                colors={['rgba(255,59,48,0.15)', 'rgba(255,59,48,0.03)']}
                style={styles.resultStatGradient}
              >
                <MaterialCommunityIcons name="close" size={18} color="#FF3B30" />
                <Text style={[styles.resultStatNum, { color: '#FF3B30' }]}>{importResult.errors.length}</Text>
                <Text style={styles.resultStatLabel}>erreurs</Text>
              </LinearGradient>
            </View>
          </View>
          {importResult.errors && importResult.errors.length > 0 && (
            <View style={{ marginTop: 12, padding: 10, backgroundColor: 'rgba(255,59,48,0.1)', borderRadius: 8 }}>
              <Text style={{ color: '#FF8A80', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>Detail des erreurs :</Text>
              {importResult.errors.slice(0, 20).map((err: string, i: number) => (
                <Text key={i} style={{ color: '#FF8A80', fontSize: 12, marginBottom: 3 }}>{err}</Text>
              ))}
              {importResult.errors.length > 20 && (
                <Text style={{ color: '#888', fontSize: 11, marginTop: 4 }}>... et {importResult.errors.length - 20} autres</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderThemesTab = () => (
    <View>
      {/* Upload Themes CSV */}
      <View style={styles.card}>
        <SectionHeader icon="file-replace-outline" title="Upload CSV Themes" subtitle="Ajoute les nouveaux thèmes et met à jour les existants. Colonnes attendues : ID_Theme;Super_Categorie;Cluster;Nom_Public;..." />
        {!themesFileName ? (
          <TouchableOpacity style={styles.uploadBtn} onPress={pickThemesCSV} activeOpacity={0.7}>
            <MaterialCommunityIcons name="clipboard-file-outline" size={32} color="#8A2BE2" style={{ marginBottom: 8 }} />
            <Text style={styles.uploadBtnText}>Choisir le CSV Themes</Text>
          </TouchableOpacity>
        ) : (
          <View>
            <View style={styles.fileInfo}>
              <MaterialCommunityIcons name="clipboard-file-outline" size={24} color="#A855F7" style={{ marginRight: 12 }} />
              <View style={styles.fileDetails}>
                <Text style={styles.fileNameText} numberOfLines={1}>{themesFileName}</Text>
                <Text style={styles.fileMetaText}>{themesPreviewCount} themes detectes</Text>
              </View>
              <TouchableOpacity style={styles.resetBtn} onPress={resetThemesCSV}>
                <MaterialCommunityIcons name="close" size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.dangerBtnWrap, uploadingThemes && styles.importBtnDisabled]}
              onPress={uploadThemesCSV}
              disabled={uploadingThemes}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF6B35', '#E55A2B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.importBtnGradient}
              >
                {uploadingThemes ? (
                  <View style={styles.importingRow}>
                    <ActivityIndicator color="#FFF" />
                    <Text style={styles.importBtnText}> Upload en cours...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="refresh" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={styles.importBtnText}>Remplacer tous les themes ({themesPreviewCount})</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        {themesUploadResult && (
          <View style={[styles.resultBanner, { marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="check-circle" size={16} color="#00C853" style={{ marginRight: 6 }} />
              <Text style={styles.resultBannerText}>
                {themesUploadResult.themes_imported} themes importes
              </Text>
            </View>
            {themesUploadResult.errors && themesUploadResult.errors.length > 0 && (
              <Text style={{ color: '#FF8A80', fontSize: 12, marginTop: 6 }}>
                Erreurs ({themesUploadResult.errors.length}): {themesUploadResult.errors.slice(0, 5).join(' | ')}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Themes Overview */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <SectionHeader icon="palette-swatch-variant" title="Vue d'ensemble des themes" />
          {selectedThemes.size > 0 && (
            <TouchableOpacity onPress={() => setSelectedThemes(new Set())} data-testid="clear-selection-btn">
              <Text style={{ color: '#888', fontSize: 12 }}>Deselectionner</Text>
            </TouchableOpacity>
          )}
        </View>
        {loadingThemes ? (
          <ActivityIndicator color="#8A2BE2" style={{ marginVertical: 12 }} />
        ) : themesOverview ? (
          <View>
            {/* Totals */}
            <View style={styles.totalsRow}>
              {[
                { num: themesOverview.totals.super_categories, label: 'Super Cat.', icon: 'shape-outline', color: '#A855F7' },
                { num: themesOverview.totals.clusters, label: 'Clusters', icon: 'group', color: '#00BFFF' },
                { num: themesOverview.totals.themes, label: 'Themes', icon: 'palette-outline', color: '#FFD700' },
                { num: themesOverview.totals.questions, label: 'Questions', icon: 'help-circle-outline', color: '#00C853' },
              ].map((item, idx) => (
                <View key={idx} style={styles.totalItemCard}>
                  <LinearGradient
                    colors={[item.color + '20', item.color + '05']}
                    style={styles.totalItemGradient}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={16} color={item.color} style={{ marginBottom: 4 }} />
                    <Text style={[styles.totalNum, { color: item.color }]}>{item.num}</Text>
                    <Text style={styles.totalLabel}>{item.label}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>

            {/* Super Categories List */}
            {themesOverview.super_categories.map((sc) => (
              <View key={sc.id} style={styles.scContainer}>
                <TouchableOpacity
                  style={[styles.scHeader, { borderLeftColor: sc.color }]}
                  onPress={() => setExpandedSC(expandedSC === sc.id ? null : sc.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.scIcon}>{sc.icon}</Text>
                  <View style={styles.scHeaderInfo}>
                    <Text style={styles.scName}>{sc.label}</Text>
                    <Text style={styles.scMeta}>{sc.total_themes} themes | {sc.total_questions} questions</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={expandedSC === sc.id ? 'chevron-down' : 'chevron-right'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {expandedSC === sc.id && sc.clusters.map((cl) => {
                  const clKey = `${sc.id}_${cl.name}`;
                  const allClusterSelected = cl.themes.length > 0 && cl.themes.every(t => selectedThemes.has(t.id));
                  const someClusterSelected = cl.themes.some(t => selectedThemes.has(t.id));
                  return (
                  <View key={cl.name} style={styles.clContainer}>
                    <TouchableOpacity
                      style={styles.clHeader}
                      onPress={() => setExpandedCluster(expandedCluster === clKey ? null : clKey)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.clIcon}>{cl.icon}</Text>
                      <View style={styles.clHeaderInfo}>
                        <Text style={styles.clName}>{cl.name}</Text>
                        <Text style={styles.clMeta}>{cl.themes.length} themes | {cl.total_questions} Q</Text>
                      </View>
                      <MaterialCommunityIcons
                        name={expandedCluster === clKey ? 'chevron-down' : 'chevron-right'}
                        size={18}
                        color="#555"
                      />
                    </TouchableOpacity>

                    {expandedCluster === clKey && (
                      <View>
                        {/* Select all cluster + delete actions */}
                        <View style={styles.selectAllRow}>
                          <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                            onPress={() => toggleClusterSelection(cl.themes)}
                          >
                            <View style={[styles.checkbox, allClusterSelected && styles.checkboxChecked, !allClusterSelected && someClusterSelected && styles.checkboxPartial]}>
                              {allClusterSelected && <MaterialCommunityIcons name="check" size={12} color="#FFF" />}
                              {!allClusterSelected && someClusterSelected && <MaterialCommunityIcons name="minus" size={12} color="#FFF" />}
                            </View>
                            <Text style={styles.selectAllText}>
                              {allClusterSelected ? 'Tout deselectionner' : 'Tout selectionner'} ({cl.themes.length})
                            </Text>
                          </TouchableOpacity>
                          {selectedThemes.size > 0 && !confirmDelete && (
                            <TouchableOpacity
                              style={styles.inlineDeleteBtn}
                              onPress={handleDeleteThemes}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialCommunityIcons name="delete" size={12} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.inlineDeleteBtnText}>
                                  Supprimer ({selectedThemes.size})
                                </Text>
                              </View>
                            </TouchableOpacity>
                          )}
                          {selectedThemes.size > 0 && confirmDelete && (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity
                                style={styles.inlineCancelBtn}
                                onPress={cancelDelete}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.inlineCancelBtnText}>Non</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.inlineConfirmBtn}
                                onPress={doDeleteThemes}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.inlineConfirmBtnText}>
                                  {deletingThemes ? '...' : 'Oui, supprimer'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {cl.themes.map((theme) => (
                        <TouchableOpacity
                          key={theme.id}
                          style={[styles.themeRow, selectedThemes.has(theme.id) && styles.themeRowSelected]}
                          onPress={() => toggleThemeSelection(theme.id)}
                          activeOpacity={0.7}
                          data-testid={`theme-row-${theme.id}`}
                        >
                          <View style={[styles.checkbox, selectedThemes.has(theme.id) && styles.checkboxChecked]}>
                            {selectedThemes.has(theme.id) && <MaterialCommunityIcons name="check" size={12} color="#FFF" />}
                          </View>
                          <View style={[styles.themeIdBadge, { backgroundColor: theme.color_hex ? theme.color_hex + '30' : 'rgba(138,43,226,0.15)' }]}>
                            <Text style={[styles.themeIdText, { color: theme.color_hex || '#8A2BE2' }]}>{theme.id}</Text>
                          </View>
                          <View style={styles.themeInfo}>
                            <Text style={styles.themeName} numberOfLines={1}>{theme.name}</Text>
                          </View>
                          <Text style={styles.themeQCount}>{theme.question_count} Q</Text>
                        </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  );
                })}
              </View>
            ))}
          </View>
        ) : <Text style={styles.noDataText}>Aucun theme en base</Text>}
      </View>
    </View>
  );

  const renderStatsTab = () => (
    <View>
      <View style={styles.card}>
        <SectionHeader icon="chart-bar" title="Parties par theme" subtitle="Themes classes par popularite (nombre de parties jouees)" />
        {loadingMatchStats ? (
          <ActivityIndicator color="#8A2BE2" style={{ marginVertical: 12 }} />
        ) : matchStats.length > 0 ? (
          <View>
            <View style={styles.totalMatchCard}>
              <LinearGradient
                colors={['rgba(138,43,226,0.2)', 'rgba(138,43,226,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.totalMatchGradient}
              >
                <MaterialCommunityIcons name="gamepad-variant-outline" size={20} color="#A855F7" style={{ marginRight: 10 }} />
                <Text style={[styles.statLabel, { fontWeight: '700', color: '#FFF' }]}>Total parties</Text>
                <Text style={styles.statValue}>{totalMatches}</Text>
              </LinearGradient>
            </View>
            {matchStats.map((stat, i) => {
              const pct = totalMatches > 0 ? (stat.match_count / totalMatches * 100) : 0;
              return (
                <View key={i} style={styles.matchStatRow}>
                  <LinearGradient
                    colors={i < 3 ? ['rgba(138,43,226,0.25)', 'rgba(138,43,226,0.08)'] : ['rgba(138,43,226,0.15)', 'rgba(138,43,226,0.03)']}
                    style={styles.matchStatRank}
                  >
                    <Text style={styles.matchStatRankText}>{i + 1}</Text>
                  </LinearGradient>
                  <View style={styles.matchStatInfo}>
                    <View style={styles.matchStatHeader}>
                      <Text style={styles.matchStatName} numberOfLines={1}>{stat.theme_name}</Text>
                      <Text style={styles.matchStatCount}>{stat.match_count}</Text>
                    </View>
                    <View style={styles.matchStatBarBg}>
                      <LinearGradient
                        colors={['#8A2BE2', '#A855F7']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.matchStatBar, { width: `${Math.max(pct, 2)}%` }]}
                      />
                    </View>
                    <Text style={styles.matchStatId}>{stat.theme_id} | {pct.toFixed(1)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <Text style={styles.noDataText}>Aucune partie jouee</Text>}
      </View>
    </View>
  );

  const renderReportsTab = () => (
    <View>
      {/* Filter */}
      <View style={styles.card}>
        <SectionHeader icon="alert-circle-outline" title="Signalements de questions" />
        <View style={styles.reportFilterRow}>
          {['', 'pending', 'reviewed', 'resolved'].map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.reportFilterBtn, reportFilter === f && styles.reportFilterBtnActive]}
              onPress={() => { setReportFilter(f); setTimeout(loadReports, 100); }}
            >
              <Text style={[styles.reportFilterText, reportFilter === f && styles.reportFilterTextActive]}>
                {f === '' ? 'Tous' : f === 'pending' ? 'En attente' : f === 'reviewed' ? 'Examine' : 'Resolu'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.reportCountsRow}>
          <View style={styles.reportCountCard}>
            <LinearGradient
              colors={['rgba(255,165,0,0.18)', 'rgba(255,165,0,0.04)']}
              style={styles.reportCountGradient}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color="#FFA500" style={{ marginBottom: 2 }} />
              <Text style={[styles.reportCountNum, { color: '#FFA500' }]}>{reportCounts.pending}</Text>
              <Text style={styles.reportCountLabel}>En attente</Text>
            </LinearGradient>
          </View>
          <View style={styles.reportCountCard}>
            <LinearGradient
              colors={['rgba(0,191,255,0.18)', 'rgba(0,191,255,0.04)']}
              style={styles.reportCountGradient}
            >
              <MaterialCommunityIcons name="eye-outline" size={16} color="#00BFFF" style={{ marginBottom: 2 }} />
              <Text style={[styles.reportCountNum, { color: '#00BFFF' }]}>{reportCounts.reviewed}</Text>
              <Text style={styles.reportCountLabel}>Examines</Text>
            </LinearGradient>
          </View>
          <View style={styles.reportCountCard}>
            <LinearGradient
              colors={['rgba(0,200,83,0.18)', 'rgba(0,200,83,0.04)']}
              style={styles.reportCountGradient}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={16} color="#00C853" style={{ marginBottom: 2 }} />
              <Text style={[styles.reportCountNum, { color: '#00C853' }]}>{reportCounts.resolved}</Text>
              <Text style={styles.reportCountLabel}>Resolus</Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Reports List */}
      {loadingReports ? (
        <ActivityIndicator color="#8A2BE2" style={{ marginVertical: 24 }} />
      ) : reports.length > 0 ? (
        reports.map((r) => (
          <View key={r.id} style={styles.reportCard}>
            <View style={styles.reportCardHeader}>
              <View style={[styles.reportStatusBadge, { backgroundColor: (STATUS_COLORS[r.status] || '#888') + '25' }]}>
                <Text style={[styles.reportStatusText, { color: STATUS_COLORS[r.status] || '#888' }]}>{r.status}</Text>
              </View>
              <Text style={styles.reportDate}>
                {r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </View>
            <Text style={styles.reportQuestionText} numberOfLines={3}>{r.question_text}</Text>
            <View style={styles.reportMetaRow}>
              <MaterialCommunityIcons name="account-outline" size={14} color="#777" style={{ marginRight: 4 }} />
              <Text style={styles.reportMetaLabel}>Joueur:</Text>
              <Text style={styles.reportMetaValue}>{r.user_pseudo}</Text>
            </View>
            <View style={styles.reportMetaRow}>
              <MaterialCommunityIcons name="tag-outline" size={14} color="#777" style={{ marginRight: 4 }} />
              <Text style={styles.reportMetaLabel}>Categorie:</Text>
              <Text style={styles.reportMetaValue}>{r.category}</Text>
            </View>
            <View style={styles.reportMetaRow}>
              <MaterialCommunityIcons name="flag-outline" size={14} color="#777" style={{ marginRight: 4 }} />
              <Text style={styles.reportMetaLabel}>Raison:</Text>
              <Text style={styles.reportMetaValue}>{REASON_LABELS[r.reason_type] || r.reason_type}</Text>
            </View>
            {r.description ? (
              <View style={styles.reportDescBox}>
                <Text style={styles.reportDescText}>{r.description}</Text>
              </View>
            ) : null}
            <View style={styles.reportActions}>
              {r.status !== 'reviewed' && (
                <TouchableOpacity
                  style={[styles.reportActionBtn, { backgroundColor: 'rgba(0,191,255,0.15)' }]}
                  onPress={() => updateReportStatus(r.id, 'reviewed')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="eye-check-outline" size={14} color="#00BFFF" style={{ marginRight: 4 }} />
                    <Text style={[styles.reportActionText, { color: '#00BFFF' }]}>Marquer examine</Text>
                  </View>
                </TouchableOpacity>
              )}
              {r.status !== 'resolved' && (
                <TouchableOpacity
                  style={[styles.reportActionBtn, { backgroundColor: 'rgba(0,200,83,0.15)' }]}
                  onPress={() => updateReportStatus(r.id, 'resolved')}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name="check-circle-outline" size={14} color="#00C853" style={{ marginRight: 4 }} />
                    <Text style={[styles.reportActionText, { color: '#00C853' }]}>Marquer resolu</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="inbox-outline" size={48} color="#555" style={{ marginBottom: 12 }} />
          <Text style={styles.emptyText}>Aucun signalement{reportFilter ? ` (${reportFilter})` : ''}</Text>
        </View>
      )}
    </View>
  );

  const renderAvatarsTab = () => (
    <View style={{ flex: 1, padding: 16 }}>
      {/* Upload form */}
      <View style={{ backgroundColor: 'rgba(138,43,226,0.08)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(138,43,226,0.2)' }}>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800', marginBottom: 12 }}>Uploader un avatar</Text>

        <TouchableOpacity
          onPress={pickAvatarImage}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' }}
        >
          {avatarImage ? (
            <Image source={{ uri: `data:image/webp;base64,${avatarImage}` }} style={{ width: 80, height: 80, borderRadius: 40 }} />
          ) : (
            <>
              <MaterialCommunityIcons name="image-plus" size={32} color="#8A2BE2" />
              <Text style={{ color: '#A3A3A3', fontSize: 13, marginTop: 6 }}>Choisir une image</Text>
            </>
          )}
        </TouchableOpacity>

        <TextInput
          style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 12, color: '#FFF', fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}
          placeholder="Categorie (ex: animaux, heros...)"
          placeholderTextColor="#525252"
          value={avatarCategory}
          onChangeText={setAvatarCategory}
        />

        <TouchableOpacity
          onPress={uploadAvatar}
          disabled={uploadingAvatar || !avatarImage}
          style={{ opacity: (!avatarImage || uploadingAvatar) ? 0.5 : 1 }}
        >
          <LinearGradient
            colors={['#8A2BE2', '#6A1FB0']}
            style={{ borderRadius: 12, padding: 14, alignItems: 'center' }}
          >
            {uploadingAvatar ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>UPLOADER</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Existing avatars grid */}
      <Text style={{ color: '#A3A3A3', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 12 }}>
        AVATARS ({avatars.length})
      </Text>

      {loadingAvatars ? (
        <ActivityIndicator color="#8A2BE2" style={{ marginTop: 20 }} />
      ) : avatars.length === 0 ? (
        <Text style={{ color: '#525252', textAlign: 'center', marginTop: 20 }}>Aucun avatar uploade</Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {avatars.map((a) => (
            <View key={a.id} style={{ alignItems: 'center', width: 80 }}>
              <Image
                source={{ uri: `${API_URL}/static/${a.image_url}` }}
                style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(138,43,226,0.3)', marginBottom: 4 }}
              />
              <Text style={{ color: '#E5E5E5', fontSize: 11, fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>{a.name}</Text>
              <Text style={{ color: '#525252', fontSize: 9 }}>{a.category}</Text>
              <TouchableOpacity
                onPress={() => deleteAvatar(a.id)}
                style={{ marginTop: 4, padding: 4 }}
              >
                <MaterialCommunityIcons name="delete-outline" size={16} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Main Admin Screen ──
  return (
    <View style={styles.opaqueWrapper} testID="admin-bg" nativeID="admin-bg">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <LinearGradient
          colors={['rgba(138,43,226,0.12)', 'transparent']}
          style={styles.header}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={16} color="#A855F7" style={{ marginRight: 6 }} />
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
            <MaterialCommunityIcons name="cog" size={22} color="#A855F7" style={{ marginRight: 8 }} />
            <Text style={styles.headerTitle}>Admin Duelo</Text>
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === i && styles.tabItemActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.7}
            >
              {activeTab === i ? (
                <LinearGradient
                  colors={['rgba(138,43,226,0.2)', 'rgba(138,43,226,0.08)']}
                  style={styles.tabItemGradient}
                >
                  <MaterialCommunityIcons name={TAB_ICONS[tab] as any} size={16} color="#A855F7" style={{ marginRight: 4 }} />
                  <Text style={styles.tabTextActive}>{tab}</Text>
                  {i === 3 && reportCounts.pending > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{reportCounts.pending}</Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={styles.tabItemInner}>
                  <MaterialCommunityIcons name={TAB_ICONS[tab] as any} size={16} color="#666" style={{ marginRight: 4 }} />
                  <Text style={styles.tabText}>{tab}</Text>
                  {i === 3 && reportCounts.pending > 0 && (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{reportCounts.pending}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8A2BE2" />}
        >
          {activeTab === 0 && renderQuestionsTab()}
          {activeTab === 1 && renderThemesTab()}
          {activeTab === 2 && renderStatsTab()}
          {activeTab === 3 && renderReportsTab()}
          {activeTab === 4 && renderAvatarsTab()}
          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Delete bar - OUTSIDE ScrollView - uses web-compatible approach */}
        {activeTab === 1 && selectedThemes.size > 0 && (
          <View style={{height: 0}} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050510' },
  opaqueWrapper: {
    flex: 1,
    backgroundColor: '#050510',
    ...(Platform.OS === 'web' ? { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 } : {}),
  },
  flex1: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Auth
  authContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  authCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(138,43,226,0.15)',
  },
  authIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  authTitle: { color: '#FFF', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  authSubtitle: { color: '#666', fontSize: 14, marginBottom: 24 },
  passwordInput: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  loginBtnWrap: { width: '100%', borderRadius: 12, overflow: 'hidden' },
  loginBtnGradient: {
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  loginBtnDisabled: { opacity: 0.5 },
  loginBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: 'rgba(138,43,226,0.1)', borderRadius: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtnText: { color: '#A855F7', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '800' },

  // Tabs
  tabBar: {
    flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  tabItem: {
    flex: 1, borderRadius: 10, overflow: 'hidden',
  },
  tabItemActive: {},
  tabItemGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10,
  },
  tabItemInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10,
  },
  tabText: { color: '#666', fontSize: 11, fontWeight: '600' },
  tabTextActive: { color: '#A855F7', fontSize: 11, fontWeight: '800' },
  tabBadge: {
    backgroundColor: '#FF3B30', borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', marginLeft: 4, paddingHorizontal: 4,
  },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // Section header
  sectionHeaderWrap: { marginBottom: 12, borderRadius: 10, overflow: 'hidden' },
  sectionHeaderGradient: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10,
  },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  cardDesc: { color: '#999', fontSize: 11, lineHeight: 17, marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardDescSub: { color: '#666', fontSize: 11, lineHeight: 16, marginTop: 2 },

  // Stats
  statLabel: { color: '#BBB', fontSize: 13, flex: 1 },
  statValue: { color: '#8A2BE2', fontSize: 20, fontWeight: '900' },
  statValueSmall: { color: '#8A2BE2', fontSize: 15, fontWeight: '700' },
  noDataText: { color: '#555', fontSize: 13 },

  // Upload
  uploadBtn: {
    backgroundColor: 'rgba(138,43,226,0.08)',
    borderRadius: 12, paddingVertical: 28, alignItems: 'center',
    borderWidth: 2, borderColor: 'rgba(138,43,226,0.3)', borderStyle: 'dashed',
  },
  uploadBtnText: { color: '#8A2BE2', fontSize: 16, fontWeight: '700' },

  // File info
  fileInfo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(138,43,226,0.08)', borderRadius: 12, padding: 12,
    marginBottom: 12,
  },
  fileDetails: { flex: 1 },
  fileNameText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  fileMetaText: { color: '#999', fontSize: 12, marginTop: 2 },
  resetBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,59,48,0.12)', justifyContent: 'center', alignItems: 'center',
  },

  // Columns
  columnsInfo: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10,
    marginBottom: 12,
  },
  columnsTitle: { color: '#777', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  columnsText: { color: '#999', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Preview
  previewSection: { marginBottom: 12 },
  previewTitle: { color: '#777', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  previewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12,
    marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#8A2BE2',
  },
  previewCategory: {
    color: '#8A2BE2', fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
  },
  previewQuestion: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // Errors
  errorsSection: {
    backgroundColor: 'rgba(255,59,48,0.06)', borderRadius: 10, padding: 12,
    marginBottom: 12,
  },
  errorsTitle: { color: '#FF8A80', fontSize: 13, fontWeight: '700' },
  errorText: { color: '#FF8A80', fontSize: 11, lineHeight: 18 },

  // Import button
  importBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  importBtnGradient: {
    paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnWrap: { borderRadius: 12, overflow: 'hidden' },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  importingRow: { flexDirection: 'row', alignItems: 'center' },

  // Results
  resultCard: { borderColor: 'rgba(0,200,83,0.2)' },
  resultTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  resultStats: { flexDirection: 'row', justifyContent: 'space-around', gap: 10 },
  resultStatCard: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  resultStatGradient: {
    alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8, borderRadius: 12,
  },
  resultStatNum: { color: '#00C853', fontSize: 26, fontWeight: '900', marginTop: 6 },
  resultStatLabel: { color: '#777', fontSize: 11, marginTop: 2, fontWeight: '600' },

  // Result banner
  resultBanner: {
    backgroundColor: 'rgba(0,200,83,0.1)', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(0,200,83,0.2)',
  },
  resultBannerText: { color: '#00C853', fontSize: 14, fontWeight: '700', textAlign: 'center' },

  // Totals row
  totalsRow: {
    flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, gap: 8,
  },
  totalItemCard: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  totalItemGradient: {
    alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 12,
  },
  totalNum: { color: '#8A2BE2', fontSize: 22, fontWeight: '900' },
  totalLabel: { color: '#888', fontSize: 9, fontWeight: '600', marginTop: 2 },

  // Total match card (stats tab)
  totalMatchCard: { marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  totalMatchGradient: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 12,
  },

  // Super Category
  scContainer: { marginBottom: 4 },
  scHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderLeftWidth: 4, marginBottom: 4,
  },
  scIcon: { fontSize: 22, marginRight: 12 },
  scHeaderInfo: { flex: 1 },
  scName: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  scMeta: { color: '#888', fontSize: 11, marginTop: 2 },

  // Cluster
  clContainer: { marginLeft: 16, marginBottom: 4 },
  clHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10,
    marginBottom: 2,
  },
  clIcon: { fontSize: 18, marginRight: 10 },
  clHeaderInfo: { flex: 1 },
  clName: { color: '#DDD', fontSize: 14, fontWeight: '600' },
  clMeta: { color: '#777', fontSize: 10, marginTop: 1 },

  // Theme row
  themeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    paddingHorizontal: 12, marginLeft: 28,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  themeRowSelected: {
    backgroundColor: 'rgba(255,59,48,0.08)',
  },
  themeIdBadge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginRight: 10,
  },
  themeIdText: { fontSize: 10, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  themeInfo: { flex: 1 },
  themeName: { color: '#CCC', fontSize: 13, fontWeight: '500' },
  themeQCount: { color: '#8A2BE2', fontSize: 13, fontWeight: '700' },

  // Match Stats
  matchStatRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  matchStatRank: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  matchStatRankText: { color: '#A855F7', fontSize: 12, fontWeight: '800' },
  matchStatInfo: { flex: 1 },
  matchStatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  matchStatName: { color: '#DDD', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  matchStatCount: { color: '#00C853', fontSize: 16, fontWeight: '800' },
  matchStatBarBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3,
    overflow: 'hidden', marginBottom: 4,
  },
  matchStatBar: { height: 6, borderRadius: 3 },
  matchStatId: { color: '#555', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Reports
  reportFilterRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  reportFilterBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  reportFilterBtnActive: { backgroundColor: 'rgba(138,43,226,0.15)', borderColor: '#8A2BE2' },
  reportFilterText: { color: '#777', fontSize: 11, fontWeight: '600' },
  reportFilterTextActive: { color: '#A855F7' },

  reportCountsRow: { flexDirection: 'row', gap: 8 },
  reportCountCard: { flex: 1, borderRadius: 10, overflow: 'hidden' },
  reportCountGradient: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 10 },
  reportCountNum: { fontSize: 20, fontWeight: '900' },
  reportCountLabel: { color: '#888', fontSize: 9, fontWeight: '600', marginTop: 2 },

  // Report card
  reportCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reportStatusBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  reportStatusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  reportDate: { color: '#666', fontSize: 10 },
  reportQuestionText: { color: '#EEE', fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 10 },
  reportMetaRow: { flexDirection: 'row', paddingVertical: 2, alignItems: 'center' },
  reportMetaLabel: { color: '#777', fontSize: 12, width: 76 },
  reportMetaValue: { color: '#BBB', fontSize: 12, fontWeight: '500', flex: 1 },
  reportDescBox: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 10, marginTop: 8,
    borderLeftWidth: 3, borderLeftColor: '#FFA500',
  },
  reportDescText: { color: '#BBB', fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  reportActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  reportActionBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  reportActionText: { fontSize: 11, fontWeight: '700' },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { color: '#666', fontSize: 14, fontWeight: '500' },

  // Checkbox
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)', marginRight: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#FF3B30', borderColor: '#FF3B30',
  },
  checkboxPartial: {
    borderColor: '#FF3B30',
  },

  // Select all row
  selectAllRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
    paddingHorizontal: 12, marginLeft: 28,
    backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4,
  },
  selectAllText: { color: '#999', fontSize: 11, fontWeight: '600' },

  // Delete bar
  deleteBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,59,48,0.12)', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
  },
  deleteBarText: { color: '#FF8A80', fontSize: 14, fontWeight: '600' },
  deleteBarBtn: {
    backgroundColor: '#FF3B30', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10,
  },
  deleteBarBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10,
  },
  cancelBtnText: { color: '#AAA', fontSize: 14, fontWeight: '600' },

  // Inline delete buttons (in select-all row)
  inlineDeleteBtn: {
    backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6,
  },
  inlineDeleteBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  inlineCancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  inlineCancelBtnText: { color: '#AAA', fontSize: 11, fontWeight: '600' },
  inlineConfirmBtn: {
    backgroundColor: '#FF3B30', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6,
  },
  inlineConfirmBtnText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
});
