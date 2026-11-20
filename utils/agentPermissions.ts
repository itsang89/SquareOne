export const permissionGroups = [
  ['Expenses', {
    'transactions:read': 'Read expenses', 'transactions:add': 'Add expenses', 'transactions:edit': 'Edit expenses',
    'transactions:delete': 'Delete expenses or settlements', 'transactions:notes': 'Read private notes',
  }],
  ['Friends', {
    'friends:read': 'Read friend names', 'friends:add': 'Add friends', 'friends:edit': 'Edit friends',
    'friends:delete': 'Delete friends and their history',
  }],
  ['Settlements & categories', {
    'settlements:read': 'Read settlements', 'settlements:add': 'Record settlements',
    'categories:read': 'Read custom categories', 'categories:add': 'Add categories', 'categories:delete': 'Delete categories',
  }],
  ['Profile & data', {
    'profile:read': 'Read profile', 'profile:edit': 'Edit profile', 'data:export': 'Export transaction history',
    'data:clear': 'Clear account history',
  }],
] as const;

export const permissionLabels = Object.fromEntries(permissionGroups.flatMap(([, permissions]) => Object.entries(permissions)));
export const allScopes = Object.keys(permissionLabels);
