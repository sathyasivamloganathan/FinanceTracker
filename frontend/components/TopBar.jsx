'use client';

import { usePrivacy } from '@/lib/PrivacyContext';
import { useAuth } from '@/lib/AuthContext';
import { IconEye, IconEyeOff } from './Icons';

export default function TopBar() {
  const { hidden, toggle } = usePrivacy();
  const { user, logout } = useAuth();

  return (
    <div className="h-[52px] border-b border-line bg-paperCard flex items-center justify-between px-4 md:px-8">
      <div className="text-[13px] text-inkMuted hidden sm:block">
        {user ? <>Signed in as <b className="text-ink">{user.email}</b></> : ''}
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 border border-line rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink bg-white hover:border-brass"
          title={hidden ? 'Amounts hidden — tap to reveal' : 'Amounts visible — tap to hide'}
        >
          {hidden ? <IconEyeOff /> : <IconEye />}
          {hidden ? 'Hidden' : 'Visible'}
        </button>
        <button onClick={logout} className="text-[12.5px] font-medium text-inkMuted hover:text-clay px-2">
          Log out
        </button>
      </div>
    </div>
  );
}
