export const permissionGroups = [
  ['Entries', {
    'entries:read': 'Read entries', 'entries:write': 'Add, edit and delete entries',
    'entries:notes': 'Read private notes', 'stats:read': 'Read stats and balances',
  }],
  ['Accounts & categories', {
    'accounts:read': 'Read accounts', 'accounts:write': 'Add, edit and archive accounts',
    'accounts:delete': 'Delete accounts',
    'categories:read': 'Read categories', 'categories:write': 'Add and edit categories',
  }],
  ['Subscriptions', {
    'subscriptions:read': 'Read subscriptions', 'subscriptions:write': 'Add, edit and pause subscriptions',
  }],
  ['Friends', {
    'friends:read': 'Read friends and balances', 'friends:add': 'Add friends', 'friends:edit': 'Edit friends',
    'friends:delete': 'Delete friends and their history',
  }],
  ['Profile & data', {
    'profile:read': 'Read profile', 'profile:edit': 'Edit profile', 'data:export': 'Export all entries',
    'data:clear': 'Clear all entries, friends and subscriptions',
  }],
] as const;

/** Needs a separate browser approval each time, on top of the permission. */
export const approvalScopes = ['accounts:delete', 'friends:delete', 'data:export', 'data:clear'];

export const permissionLabels = Object.fromEntries(permissionGroups.flatMap(([, permissions]) => Object.entries(permissions)));
export const allScopes = Object.keys(permissionLabels);

/** What a typical logging agent needs, preselected when connecting. */
export const defaultScopes = [
  'entries:read', 'entries:write', 'stats:read', 'accounts:read', 'categories:read', 'categories:write', 'friends:read',
];
