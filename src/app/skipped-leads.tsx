import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { clearAllSkipped, deleteLead, getSkippedLeads, unskipLead } from '../api';
import { GhostButton, IconLabel } from '../components/buttons';
import { Pill } from '../components/pill';
import { useToast } from '../components/toast';
import { cardShadow, radius, useTheme } from '../theme';
import { Lead } from '../types';

type ConfirmTarget = { type: 'clearAll' } | { type: 'delete'; lead: Lead };

export default function SkippedLeadsScreen() {
  const colors = useTheme();
  const toast = useToast();
  const navigation = useNavigation();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  // Alert.alert wasn't reliably showing/responding on device for these
  // destructive confirmations, so they use the app's own Modal instead —
  // the same pattern already proven to work elsewhere (password change, etc).
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const load = useCallback(() => {
    getSkippedLeads().then(setLeads);
  }, []);

  useFocusEffect(load);

  const restore = async (lead: Lead) => {
    await unskipLead(lead.id);
    setLeads((prev) => (prev ? prev.filter((l) => l.id !== lead.id) : prev));
    toast(`${lead.name} restored to Leads`);
  };

  const clearAll = () => {
    if (!leads || leads.length === 0) return;
    setConfirmTarget({ type: 'clearAll' });
  };

  const runConfirmedAction = async () => {
    if (!confirmTarget) return;
    if (confirmTarget.type === 'clearAll') {
      await clearAllSkipped();
      setLeads([]);
      toast('Skipped leads cleared');
    } else {
      const { lead } = confirmTarget;
      await deleteLead(lead.id);
      setLeads((prev) => (prev ? prev.filter((l) => l.id !== lead.id) : prev));
      toast(`${lead.name} deleted`);
    }
    setConfirmTarget(null);
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        leads && leads.length > 0 ? (
          <View style={styles.headerRight}>
            <Pressable
              onPress={clearAll}
              hitSlop={8}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.headerButtonLabel, { color: colors.danger }]}>Clear all</Text>
            </Pressable>
          </View>
        ) : null,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [navigation, colors, leads]);

  if (!leads) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <>
    <FlatList
      data={leads}
      keyExtractor={(l) => l.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.subtext }]}>
          No skipped leads — anything you skip shows up here.
        </Text>
      }
      renderItem={({ item: lead }) => (
        <View style={[styles.card, cardShadow, { backgroundColor: colors.card }]}>
          <Pressable
            onPress={() => setConfirmTarget({ type: 'delete', lead })}
            hitSlop={8}
            style={({ pressed }) => [styles.cardClose, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="close" size={18} color={colors.faint} />
          </Pressable>

          <View style={styles.headerRow}>
            <Text style={[styles.name, { color: colors.text }]}>{lead.name}</Text>
            <Pill
              label={lead.source}
              color={lead.source === 'StreetEasy' ? colors.teal : colors.amber}
              background={lead.source === 'StreetEasy' ? colors.tealSoft : colors.amberSoft}
            />
          </View>
          <Text style={[styles.listing, { color: colors.subtext }]}>
            <Ionicons name="location-outline" size={13} color={colors.subtext} /> {lead.listing}
          </Text>
          <Text style={[styles.received, { color: colors.faint }]}>{lead.receivedAt}</Text>

          <Pressable
            onPress={() => restore(lead)}
            style={({ pressed }) => [
              styles.restoreButton,
              { borderColor: colors.neutral, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <IconLabel
              icon="arrow-undo-outline"
              iconSize={16}
              color={colors.teal}
              label="Restore to Leads"
              fontSize={13}
              fontWeight="600"
            />
          </Pressable>
        </View>
      )}
    />

    <Modal
      visible={confirmTarget !== null}
      transparent
      animationType="fade"
      onRequestClose={() => setConfirmTarget(null)}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setConfirmTarget(null)}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {confirmTarget && (
            <>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {confirmTarget.type === 'clearAll'
                  ? 'Clear all skipped leads?'
                  : 'Delete this lead?'}
              </Text>
              <Text style={[styles.modalBody, { color: colors.subtext }]}>
                {confirmTarget.type === 'clearAll'
                  ? `All ${leads?.length ?? 0} skipped lead${leads?.length === 1 ? '' : 's'} will be restored to your active Leads list.`
                  : `${confirmTarget.lead.name}'s lead and email will be permanently removed from Hazbot.`}
              </Text>
              <View style={styles.modalActions}>
                <GhostButton
                  label="Cancel"
                  onPress={() => setConfirmTarget(null)}
                  style={styles.modalButton}
                />
                <Pressable
                  onPress={runConfirmedAction}
                  style={({ pressed }) => [
                    styles.modalDangerButton,
                    { backgroundColor: colors.danger, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={styles.modalDangerLabel}>
                    {confirmTarget.type === 'clearAll' ? 'Clear all' : 'Delete'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14, paddingHorizontal: 24 },
  card: { borderRadius: radius.card, padding: 16 },
  cardClose: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingRight: 26,
  },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  listing: { fontSize: 13, marginTop: 4 },
  received: { fontSize: 11, marginTop: 8 },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingVertical: 9,
    marginTop: 12,
  },
  restoreLabel: { fontSize: 13, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerButtonLabel: { fontSize: 14, fontWeight: '600' },
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
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1 },
  modalDangerButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDangerLabel: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: '#FFFFFF' },
});
