import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getContactNote, setContactNote } from '../api';
import { cardShadow, HEADER_ICON_SIZE, radius, useTheme } from '../theme';
import { Lead, LeadSource } from '../types';
import { formatPhoneDisplay } from '../validation';
import { useContactSheet } from './contactSheet';
import { Pill } from './pill';
import { useToast } from './toast';

function sourceColors(source: LeadSource, colors: ReturnType<typeof useTheme>) {
  if (source === 'StreetEasy') return { color: colors.teal, background: colors.card };
  if (source === 'Zillow') return { color: colors.amber, background: colors.amberSoft };
  return { color: colors.subtext, background: colors.card };
}

interface ContactDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (lead: Lead) => void;
  onAddToContacts: (lead: Lead) => void;
  onRemove: (lead: Lead) => void;
}

/** Shared contact detail card — used by both the Contacts list and the
 * Favorites list so the two stay visually and functionally identical. */
export function ContactDetailModal({
  lead,
  onClose,
  favoriteIds,
  onToggleFavorite,
  onAddToContacts,
  onRemove,
}: ContactDetailModalProps) {
  const colors = useTheme();
  const toast = useToast();
  const { callPhone, textPhone, emailAddress } = useContactSheet();
  const [note, setNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNote, setEditingNote] = useState(false);

  useEffect(() => {
    if (!lead) return;
    setEditingNote(false);
    getContactNote(lead.id).then((n) => {
      setNote(n);
      setNoteDraft(n);
    });
  }, [lead]);

  const saveNote = async (target: Lead) => {
    await setContactNote(target.id, noteDraft);
    setNote(noteDraft.trim());
    setEditingNote(false);
    toast('Note saved');
  };

  return (
    <Modal visible={lead !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, cardShadow, { backgroundColor: colors.card }]}
          onPress={() => {}}
        >
          {lead && (
            <>
              <View style={[styles.modalHeader, { backgroundColor: colors.teal }]}>
                <Text style={[styles.modalName, { color: colors.onTeal }]}>{lead.name}</Text>
                <View style={styles.modalPillWrap}>
                  <Pill
                    label={lead.source}
                    color={sourceColors(lead.source, colors).color}
                    background={sourceColors(lead.source, colors).background}
                  />
                </View>

                <View style={styles.modalMetaList}>
                  <Text style={[styles.modalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="call-outline" size={14} color={colors.onTeal} />{' '}
                    {formatPhoneDisplay(lead.phone)}
                  </Text>
                  <Text style={[styles.modalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="mail-outline" size={14} color={colors.onTeal} /> {lead.email}
                  </Text>
                  <Text style={[styles.modalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="location-outline" size={14} color={colors.onTeal} />{' '}
                    {lead.listing}
                  </Text>
                  <Text style={[styles.modalMetaRow, { color: colors.onTeal }]}>
                    <Ionicons name="calendar-outline" size={14} color={colors.onTeal} />{' '}
                    Inquired {lead.receivedAt}
                  </Text>
                </View>
              </View>

              <View style={styles.modalActionsList}>
                <Pressable
                  onPress={() => {
                    const phone = lead.phone;
                    onClose();
                    callPhone(phone);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="call" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]}>Call</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => {
                    const phone = lead.phone;
                    onClose();
                    textPhone(phone);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="chatbubble" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]}>Text</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => {
                    const email = lead.email;
                    onClose();
                    emailAddress(email);
                  }}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.tealSoft }]}>
                    <Ionicons name="mail" size={HEADER_ICON_SIZE} color={colors.teal} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.teal }]}>Email</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => setEditingNote((o) => !o)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
                    <Ionicons name="document-text" size={HEADER_ICON_SIZE} color={colors.text} />
                  </View>
                  <View style={styles.actionTextCol}>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>Notes</Text>
                    {!editingNote && (
                      <Text style={[styles.actionSubtitle, { color: colors.faint }]} numberOfLines={1}>
                        {note || 'Add a note'}
                      </Text>
                    )}
                  </View>
                  <Ionicons
                    name={editingNote ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.faint}
                  />
                </Pressable>
                {editingNote && (
                  <View style={styles.noteEditor}>
                    <TextInput
                      style={[
                        styles.noteInput,
                        { color: colors.text, backgroundColor: colors.cardAlt, borderColor: colors.border },
                      ]}
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      placeholder="Type a note about this contact…"
                      placeholderTextColor={colors.faint}
                      multiline
                    />
                    <View style={styles.noteEditorButtons}>
                      <Pressable
                        onPress={() => {
                          setNoteDraft(note);
                          setEditingNote(false);
                        }}
                        style={[styles.noteButton, { backgroundColor: colors.neutral }]}
                      >
                        <Text style={[styles.noteButtonLabel, { color: colors.text }]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => saveNote(lead)}
                        style={[styles.noteButton, { backgroundColor: colors.teal }]}
                      >
                        <Text style={[styles.noteButtonLabel, { color: colors.onTeal }]}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => onAddToContacts(lead)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={[styles.actionIconBadge, { backgroundColor: colors.neutral }]}>
                    <Ionicons name="person-add" size={HEADER_ICON_SIZE} color={colors.text} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Add to Contacts</Text>
                </Pressable>
                <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                <Pressable
                  onPress={() => onRemove(lead)}
                  style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View style={styles.actionIcon}>
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </View>
                  <Text style={[styles.actionLabel, { color: colors.danger }]}>Remove Contact</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Rendered last so it paints above the header's full-width
              (if empty) hit area and never receives taps. */}
          {lead && (
            <Pressable
              onPress={() => onToggleFavorite(lead)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.modalFavoriteButton,
                { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons
                name={favoriteIds.has(lead.id) ? 'star' : 'star-outline'}
                size={HEADER_ICON_SIZE}
                color={colors.amber}
              />
            </Pressable>
          )}
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [
              styles.modalCloseButton,
              { backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="close" size={HEADER_ICON_SIZE} color={colors.subtext} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    overflow: 'hidden',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFavoriteButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18 },
  modalName: { fontSize: 18, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  modalPillWrap: { alignSelf: 'center', marginTop: 8 },
  modalMetaList: { alignSelf: 'stretch', marginTop: 18, gap: 8 },
  modalMetaRow: { fontSize: 13.5 },
  modalActionsList: { alignSelf: 'stretch', paddingHorizontal: 20, paddingBottom: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  actionIcon: { width: 22, alignItems: 'center', justifyContent: 'center' },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: { flex: 1 },
  actionLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  actionSubtitle: { fontSize: 12, marginTop: 2 },
  actionDivider: { height: 1, marginLeft: 34 },
  noteEditor: { paddingBottom: 14, gap: 10 },
  noteInput: {
    borderWidth: 1,
    borderRadius: radius.input,
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  noteEditorButtons: { flexDirection: 'row', gap: 10, alignSelf: 'flex-end' },
  noteButton: {
    borderRadius: radius.button,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  noteButtonLabel: { fontSize: 13.5, fontWeight: '700' },
});
