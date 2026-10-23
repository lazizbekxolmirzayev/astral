import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  // 200 with a null user: "not signed in" is an expected state, not an error the browser console should log.
  if (!session?.user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    },
  });
}
