import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { EditableSection, type SectionMessage } from '@/components/settings/EditableSection';
import { TextField } from '@/components/TextField';
import { Colors } from '@/constants/theme';

interface ProfileSectionProps {
  name: string;
  email: string | undefined;
  onSave: (name: string) => Promise<void>;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ name: initialName, email, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SectionMessage | null>(null);

  const toggleEditing = () => {
    if (editing) {
      setName(initialName);
      setMessage(null);
    }
    setEditing((v) => !v);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(name.trim());
      setMessage({ kind: 'success', text: 'Profile updated successfully.' });
      setEditing(false);
    } catch {
      setMessage({ kind: 'error', text: 'Could not save your name.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditableSection
      title="Profile"
      summaryLabel="Name"
      summaryValue={initialName}
      editing={editing}
      onToggleEditing={toggleEditing}
      message={message}
    >
      <TextField
        label="Name"
        value={name}
        onChangeText={(text) => { setName(text); setMessage(null); }}
        autoCapitalize="words"
      />
      <TextField label="Email address" value={email} editable={false} style={styles.disabledInput} />
      <Button title="Save" onPress={handleSave} loading={saving} />
    </EditableSection>
  );
};

const styles = StyleSheet.create({
  disabledInput: { backgroundColor: Colors.zinc200, color: Colors.textSecondary },
});
