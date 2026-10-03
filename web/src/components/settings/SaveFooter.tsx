import React from 'react';
import { Save } from 'lucide-react';
import { Button } from '../common/Button';

export const SaveFooter: React.FC<{ saving?: boolean; onSave: () => void }> = ({ saving = false, onSave }) => (
  <div className="mt-8 pt-8 border-t border-[var(--border-color)] flex justify-end">
    <Button onClick={onSave} disabled={saving}>
      {saving ? (
        <>Saving...</>
      ) : (
        <>
          <Save size={18} className="mr-2" />
          Save Changes
        </>
      )}
    </Button>
  </div>
);
