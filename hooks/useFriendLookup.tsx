import { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Friend } from '../types';

export function useFriendLookup(friendId: string | null | undefined): Friend | undefined {
  const { friends } = useAppContext();
  
  return useMemo(() => {
    if (!friendId) return undefined;
    return friends.find(f => f.id === friendId);
  }, [friends, friendId]);
}
