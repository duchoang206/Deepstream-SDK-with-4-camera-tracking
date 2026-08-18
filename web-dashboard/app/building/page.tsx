'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BuildingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?tab=building');
  }, [router]);

  return null;
}
