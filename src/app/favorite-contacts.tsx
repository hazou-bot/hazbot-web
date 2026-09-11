import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getContacts, getFavoriteContactIds, removeContact, toggleContactFavorite } from '../api';
import { addToDeviceContacts } from '../deviceContacts';
import { GhostButton, PrimaryButton } from '../components/buttons';
import { ContactDetailModal } from '../components/contactDetailModal';
import { Pill } from '../components/pill';
import { PressableCard } from '../components/pressableCard';
import { useToast } from '../components/toast';
import { cardShadow, radius, useTheme } from '../theme';
import { Lead, LeadSource } from '../types';
import { formatPhoneDisplay } from '../validation';

type SortOrder = 'newest' | 'oldest';

/** Digits-only comparison so "(917) 555-0164" matches a query of "9175550164". */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function sourceColors(source: LeadSource, colors: ReturnType<typeof useTheme>) {
  if (source === 'StreetEasy') return { color: colors.teal, background: colors.tealSoft };
  if (source === 'Zillow') return { color: colors.amber, background: colors.amberSoft };
  return { color: colors.subtext, background: colors.cardAlt };
}

export default function FavoriteContactsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const [contacts, setContacts] = useState<Lead[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Lead | null>(null);

  const load = () => {
    getContacts().then(setContacts);
    getFavoriteContactIds().then(setFavoriteIds);
  };
  useEffect(() => {
    load();
  }, []);

  const favorites = useMemo(() => {
    if (!contacts) return [];
    // Mock data is authored newest-first; "oldest" just reverses that order.
    const ordered = sort === 'newest' ? contacts : [...contacts].reverse();
    return ordered.filter((c) => favoriteIds.has(c.id));
  }, [contacts, favoriteIds, sort]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return favorites;
    const qDigits = digitsOnly(query);
    return favorites.filter((c) => {
      if (qDigits.length >= 3 && digitsOnly(c.phone).includes(qDigits)) return true;
      return [c.name, c.listing, c.email].join(' ').toLowerCase().includes(q);
    });
  }, [favorites, query]);

  const addToPhone = async (lead: Lead) => {
    const opened = await addToDeviceContacts(lead);
    if (!opened) {
      toast('Adding to Contacts isn’t available on this device — try a real iPhone.', 'error');
    }
  };

  const toggleFavorite = async (lead: Lead) => {
    const nowFavorite = await toggleContactFavorite(lead.id);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (nowFavorite) next.add(lead.id);
      else next.delete(lead.id);
      return next;
    });
    toast(nowFavorite ? `${lead.name} added to Favorites` : `${lead.name} removed from Favorites`);
  };

  // Alert.alert has no reliable web implementation (silently no-ops in the
  // browser preview), so the remove confirmation is a plain in-app modal
  // instead — works identically on web and native.
  const confirmRemove = (lead: Lead) => {
    setRemoveTarget(lead);
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    const lead = removeTarget;
    await removeContact(lead.id);
    setRemoveTarget(null);
    setSelected(null);
    setContacts((prev) => (prev ? prev.filter((c) => c.id !== lead.id) : prev));
    toast(`${lead.name} removed from Contacts`);
  };

  if (!contacts) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={results}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View
              style={[
                styles.searchBar,
                cardShadow,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={colors.faint} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search name, phone, or address…"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.faint} />
                </Pressable>
              )}
            </View>
            <View style={styles.resultsRow}>
              <Text style={[styles.resultsCount, { color: colors.faint }]}>
                {results.length} favorite{results.length === 1 ? '' : 's'}
              </Text>
              <Pressable
                onPress={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                style={({ pressed }) => [styles.sortButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Ionicons name="swap-vertical-outline" size={15} color={colors.teal} />
                <Text style={[styles.sortLabel, { color: colors.teal }]}>
                  {sort === 'newest' ? 'Newest first' : 'Oldest first'}
                </Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>
            {query
              ? `No favorites match “${query}”.`
              : 'No favorite contacts yet — tap the star on a contact to add one.'}
          </Text>
        }
        renderItem={({ item }) => (
          <PressableCard onPress={() => setSelected(item)} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardNameRow}>
                <Ionicons name="star" size={14} color={colors.amber} />
                <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
              </View>
              <Pill
                label={item.source}
                color={sourceColors(item.source, colors).color}
                background={sourceColors(item.source, colors).background}
              />
            </View>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              <Ionicons name="location-outline" size={13} color={colors.subtext} /> {item.listing}
            </Text>
            <Text style={[styles.meta, { color: colors.subtext }]}>
              <Ionicons name="call-outline" size={13} color={colors.subtext} /> {formatPhoneDisplay(item.phone)}
            </Text>
            <Text style={[styles.received, { color: colors.faint }]}>{item.receivedAt}</Text>
          </PressableCard>
        )}
      />

      <ContactDetailModal
        lead={selected}
        onClose={() => setSelected(null)}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onAddToContacts={addToPhone}
        onRemove={confirmRemove}
      />

      <Modal
        visible={removeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRemoveTarget(null)}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Remove this contact?</Text>
            <Text style={[styles.confirmBody, { color: colors.subtext }]}>
              {removeTarget?.name} will be removed from your Contacts list in AgentEasy. This won’t
              affect your phone’s Contacts app.
            </Text>
            <View style={[styles.searchActions, { marginTop: 16 }]}>
              <GhostButton
                label="Cancel"
                onPress={() => setRemoveTarget(null)}
                style={styles.searchActionButton}
              />
              <PrimaryButton
                label="Remove"
                onPress={doRemove}
                background={colors.danger}
                textColor="#FFFFFF"
                style={styles.searchActionButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 18, gap: 14, paddingBottom: 36 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  resultsCount: { fontSize: 12, fontWeight: '600' },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sortLabel: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 14, paddingHorizontal: 24 },
  card: { padding: 18 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  name: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1 },
  meta: { fontSize: 13, marginTop: 5 },
  received: { fontSize: 11, marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  confirmBody: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  searchActions: { flexDirection: 'row', gap: 10 },
  searchActionButton: { flex: 1 },
});
