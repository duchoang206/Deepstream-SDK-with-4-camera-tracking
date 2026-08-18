'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MonitorRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?tab=monitor');
  }, [router]);

  return null;
}
