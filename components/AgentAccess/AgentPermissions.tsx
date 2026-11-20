import { allScopes, permissionGroups } from '../../utils/agentPermissions';

export function AgentPermissions({ value, onChange, disabled }: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="mb-5">
      <legend className="mb-2 font-black">Permissions</legend>
      <button type="button" className="mb-3 text-sm font-bold underline"
        onClick={() => onChange(value.length === allScopes.length ? [] : allScopes)}>
        {value.length === allScopes.length ? 'Clear all permissions' : 'Select all permissions'}
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        {permissionGroups.map(([name, permissions]) => (
          <fieldset key={name} className="border-2 border-black/20 dark:border-white/20 px-3 pb-2">
            <legend className="px-1 text-sm font-bold">{name}</legend>
            {Object.entries(permissions).map(([scope, label]) => (
              <label key={scope} className="flex min-h-8 items-center gap-2 text-sm">
                <input type="checkbox" checked={value.includes(scope)}
                  onChange={(event) => onChange(event.target.checked ? [...value, scope] : value.filter((item) => item !== scope))} />
                {label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="mt-2 text-xs">Deleting a friend, exporting history, and clearing history require separate browser approval.</p>
    </fieldset>
  );
}
