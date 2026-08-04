import { NextResponse } from 'next/server';

// In-memory data store for the demo
// In a real application, this would be a database or a memory cache like Redis
let analyticsData = {
  agv: 0,
  person: 0,
  rack: 0
};

export async function GET() {
  return NextResponse.json(analyticsData);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Update data if provided in the body
    if (typeof body.agv === 'number') analyticsData.agv = body.agv;
    if (typeof body.person === 'number') analyticsData.person = body.person;
    if (typeof body.rack === 'number') analyticsData.rack = body.rack;

    return NextResponse.json({ success: true, data: analyticsData });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
  }
}
