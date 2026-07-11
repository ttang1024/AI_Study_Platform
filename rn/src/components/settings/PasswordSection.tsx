import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Info } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { EditableSection, type SectionMessage } from '@/components/settings/EditableSection';
import { InfoBanner } from '@/components/InfoBanner';
import { TextField } from '@/components/TextField';
import { validatePassword } from '@/utils/validatePassword';

interface PasswordSectionProps {
  onSave: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
}

export const PasswordSection: React.FC<PasswordSectionProps> = ({ onSave }) => {
  const [editing, setEditing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SectionMessage | null>(null);

  const toggleEditing = () => {
    if (editing) {
      setCurrentPassword('');
      setNewPassword('');
      setMessage(null);
    }
    setEditing((v) => !v);
  };

  const newPasswordValid = validatePassword(newPassword);

  const handleSave = async () => {
    setMessage(null);
    if (!currentPassword) {
      setMessage({ kind: 'error', text: 'Please enter your current password.' });
      return;
    }
    if (!newPassword) {
      setMessage({ kind: 'error', text: 'Please enter a new password.' });
      return;
    }
    if (!newPasswordValid) {
      setMessage({ kind: 'error', text: 'New password must be 8-20 characters and include at least 3 of: uppercase, lowercase, numbers, symbols.' });
      return;
    }
    setSaving(true);
    try {
      await onSave({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage({ kind: 'success', text: 'Password changed successfully.' });
      setEditing(false);
    } catch {
      setMessage({ kind: 'error', text: 'Current password is incorrect.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <EditableSection
      title="Change Password"
      summaryLabel="Password"
      summaryValue="••••••••"
      editing={editing}
      onToggleEditing={toggleEditing}
      message={message}
    >
      <TextField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureToggle />
      <View style={styles.field}>
        <TextField
          label="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureToggle
          variant={newPassword ? (newPasswordValid ? 'valid' : 'invalid') : 'default'}
        />
        <InfoBanner
          icon={Info}
          text="Password must be 8-20 characters long and include at least 3 types: uppercase letters, lowercase letters, numbers, or symbols."
        />
      </View>
      <Button title="Update Password" onPress={handleSave} loading={saving} />
    </EditableSection>
  );
};

const styles = StyleSheet.create({
  field: { gap: 6 },
});
