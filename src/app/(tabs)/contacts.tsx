import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  addManualContact,
  getContacts,
  getFavoriteContactIds,
  removeContact,
  toggleContactFavorite,
} from '../../api';
import { addToDeviceContacts } from '../../deviceContacts';
import { GhostButton, PrimaryButton } from '../../components/buttons';
import { ContactDetailModal } from '../../components/contactDetailModal';
import { Pill } from '../../components/pill';
import { PressableCard } from '../../components/pressableCard';
import { useToast } from '../../components/toast';
import {
  cardShadow,
  HEADER_ICON_SIZE,
  headerIconButton,
  headerRightRow,
  radius,
  useTheme,
} from '../../theme';
import { Lead, LeadSource } from '../../types';
import { formatPhoneDisplay, formatPhoneInput } from '../../validation';

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

export default function ContactsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const [contacts, setContacts] = useState<Lead[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortOrder>('newest');
  const [selected, setSelected] = useState<Lead | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Lead | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newListing, setNewListing] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    getContacts().then(setContacts);
    getFavoriteContactIds().then(setFavoriteIds);
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={headerRightRow}>
          <Pressable
            onPress={() => router.push('/favorite-contacts')}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="star" size={HEADER_ICON_SIZE} color={colors.amber} />
          </Pressable>
          <Pressable
            onPress={() => setAddOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [
              headerIconButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="add" size={HEADER_ICON_SIZE} color={colors.teal} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, colors, router]);

  // Mock data is authored newest-first; "oldest" just reverses that order.
  const sortedContacts = useMemo(() => {
    if (!contacts) return [];
    return sort === 'newest' ? contacts : [...contacts].reverse();
  }, [contacts, sort]);

  // Only computed while the search popup is open with something typed —
  // this is a quick-find picker, not a filter on the main list below.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const qDigits = digitsOnly(searchQuery);
    return sortedContacts.filter((c) => {
      if (qDigits.length >= 3 && digitsOnly(c.phone).includes(qDigits)) return true;
      return [c.name, c.listing, c.email].join(' ').toLowerCase().includes(q);
    });
  }, [sortedContacts, searchQuery]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery('');
  };

  const pickSearchResult = (contact: Lead) => {
    setSelected(contact);
    closeSearch();
  };

  const closeAdd = () => {
    setAddOpen(false);
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewListing('');
  };

  const saveNewContact = async () => {
    if (!newName.trim()) {
      toast('Enter a name to add this client.', 'error');
      return;
    }
    setSaving(true);
    const created = await addManualContact({
      name: newName.trim(),
      phone: newPhone.trim(),
      email: newEmail.trim(),
      listing: newListing.trim(),
    });
    setContacts((prev) => (prev ? [created, ...prev] : [created]));
    setSaving(false);
    closeAdd();
    toast(`${created.name} added to Contacts`);
  };

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
        data={sortedContacts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.resultsRow}>
            <Text style={[styles.resultsCount, { color: colors.faint }]}>
              {sortedContacts.length} contact{sortedContacts.length === 1 ? '' : 's'}
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
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.subtext }]}>No contacts yet.</Text>
        }
        renderItem={({ item }) => (
          <PressableCard onPress={() => setSelected(item)} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardNameRow}>
                {favoriteIds.has(item.id) && (
                  <Ionicons name="star" size={14} color={colors.amber} />
                )}
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

      <View style={styles.favFab} pointerEvents="box-none">
        <Pressable
          onPress={() => setSearchOpen(true)}
          style={({ pressed }) => [
            styles.favFabButton,
            cardShadow,
            { backgroundColor: colors.teal, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.onTeal} />
          <Text style={[styles.favFabLabel, { color: colors.onTeal }]}>Search</Text>
        </Pressable>
      </View>

      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={closeSearch}>
        <Pressable style={styles.searchModalBackdrop} onPress={closeSearch}>
          <Pressable
            style={[styles.searchModalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={colors.faint} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search name, phone, or address…"
                placeholderTextColor={colors.faint}
                autoCapitalize="none"
                autoFocus
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color={colors.faint} />
                </Pressable>
              )}
            </View>

            {searchQuery.trim().length > 0 && (
              searchResults.length === 0 ? (
                <Text style={[styles.suggestEmpty, { color: colors.subtext }]}>
                  No contacts match “{searchQuery}”.
                </Text>
              ) : (
                <ScrollView
                  style={styles.suggestScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {searchResults.map((c, i) => (
                    <Pressable
                      key={c.id}
                      onPress={() => pickSearchResult(c)}
                      style={({ pressed }) => [
                        styles.suggestRow,
                        i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.suggestName, { color: colors.text }]} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <Text style={[styles.suggestMeta, { color: colors.subtext }]} numberOfLines={1}>
                          {formatPhoneDisplay(c.phone)} · {c.listing}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                    </Pressable>
                  ))}
                </ScrollView>
              )
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addOpen} transparent animationType="fade" onRequestClose={closeAdd}>
        <Pressable style={styles.modalBackdrop} onPress={closeAdd}>
          <Pressable
            style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
            onPress={() => {}}
          >
            <View style={styles.detailHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add client</Text>
              <Pressable
                onPress={closeAdd}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.detailCloseButton,
                  { backgroundColor: colors.cardAlt, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="close" size={18} color={colors.subtext} />
              </Pressable>
            </View>

            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 14 }]}>Name</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="e.g. Jordan Kim"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>Phone</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newPhone}
              onChangeText={(t) => setNewPhone(formatPhoneInput(t))}
              placeholder="e.g. 646-555-0189"
              placeholderTextColor={colors.faint}
              keyboardType="phone-pad"
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>Email</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="e.g. jordan@email.com"
              placeholderTextColor={colors.faint}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, { color: colors.subtext, marginTop: 12 }]}>Address</Text>
            <TextInput
              style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newListing}
              onChangeText={setNewListing}
              placeholder="e.g. 212 Bedford Ave #3F"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={saveNewContact}
            />

            <View style={[styles.searchActions, { marginTop: 16 }]}>
              <GhostButton label="Cancel" onPress={closeAdd} style={styles.searchActionButton} />
              <PrimaryButton
                label={saving ? 'Saving…' : 'Add client'}
                onPress={saveNewContact}
                style={styles.searchActionButton}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              {removeTarget?.name} will be removed from your Contacts list in Hazbot. This won’t
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
  // Extra bottom padding clears the floating "Search" pill so the last
  // card in the list is never hidden behind it. Top padding is deliberately
  // tight — the results row is the first thing under the header and should
  // sit close to it.
  list: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 100, gap: 14 },
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
  favFab: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 12,
  },
  favFabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  favFabLabel: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  // Anchored toward the top rather than dead-center — reads as a quick-find
  // spotlight, not a full-screen dialog you have to look down to reach.
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 22, 20, 0.55)',
    alignItems: 'center',
    paddingTop: 90,
    paddingHorizontal: 20,
  },
  searchModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    padding: 14,
  },
  suggestScroll: { maxHeight: 340, marginTop: 10 },
  suggestEmpty: { fontSize: 13.5, textAlign: 'center', paddingVertical: 20 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  suggestName: { fontSize: 15, fontWeight: '700' },
  suggestMeta: { fontSize: 12.5, marginTop: 2 },
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
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  confirmBody: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  detailCloseButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  searchActions: { flexDirection: 'row', gap: 10 },
  searchActionButton: { flex: 1 },
});
