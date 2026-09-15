import React from 'react';
import { GroupsTab } from './spaces/GroupsTab';

/** /spaces — study groups. /groups redirects here. */
export const SpacesPage: React.FC = () => (
  <div className="space-y-5">
    <div>
      <h1 className="text-4xl font-semibold tracking-tight text-text-main leading-tight">
        Study <span className="text-teal-600">groups</span>
      </h1>
      <p className="mt-1 text-sm text-text-muted">Collaborate and share resources with classmates.</p>
    </div>
    <GroupsTab />
  </div>
);

export default SpacesPage;
