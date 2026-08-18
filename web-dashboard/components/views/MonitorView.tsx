'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLanguage } from '../LanguageContext';
import { useCameras, Camera } from '../CameraContext';
import { Activity, ShieldAlert, Users, Layers, AlertCircle, ArrowRightLeft, Radio } from 'lucide-react';

type TrackedObject = {
  id: number;
  local_id?: number;
  class: string;
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
  floor_x?: number;
  floor_y?: number;
  confidence?: number;
};

type LiveAlert = {
  cam_id: string;
  global_id: number;
  rule_type: string;
  severity: string;
  description: string;
  timestamp: number;
};

type InterpolatedTrack = {
  id: number;
  curX: number;
  curY: number;
  curW: number;
  curH: number;
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  floorX: number;
  floorY: number;
  lastUpdated: number;
};

function CameraStreamCard({
  cam,
  hostName,
  isVisible,
  activeTab,
  metadataMap
}: {
  cam: Camera;
  hostName: string;
  isVisible: boolean;
  activeTab: string;
  metadataMap: React.MutableRefObject<Map<string, Map<number, InterpolatedTrack>>>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useIframeFallback, setUseIframeFallback] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // 1. Ultra-Low-Latency Direct WHEP WebRTC Connection
  useEffect(() => {
    let isCancelled = false;
    let reconnectTimeout: any = null;

    const connectWHEP = async () => {
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pcRef.current = pc;

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            videoRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            setIsPlaying(false);
            if (!isCancelled) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(connectWHEP, 1500);
            }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Fetch WHEP Answer from MediaMTX
        const whepUrl = `http://${hostName}:8081/${cam.id}/whep`;
        const res = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: offer.sdp
        });

        if (!res.ok) {
          throw new Error(`WHEP HTTP ${res.status}`);
        }

        const answerSdp = await res.text();
        if (!isCancelled && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
        }
      } catch (err) {
        if (!isCancelled) {
          // Fallback to clean iframe if direct WHEP endpoint fails
          setUseIframeFallback(true);
          clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(connectWHEP, 4000);
        }
      }
    };

    connectWHEP();

    return () => {
      isCancelled = true;
      clearTimeout(reconnectTimeout);
      if (pcRef.current) {
        try { pcRef.current.close(); } catch (e) {}
        pcRef.current = null;
      }
    };
  }, [cam.id, hostName]);

  // 2. 60 FPS Real-time Tracking Canvas Render
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const rect = container.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const camTracks = metadataMap.current.get(cam.id);
          const now = Date.now();

          if (camTracks) {
            camTracks.forEach((track, id) => {
              const age = now - track.lastUpdated;
              if (age > 800) {
                camTracks.delete(id);
                return;
              }

              // Smooth lerp
              const lerpFactor = 0.25;
              track.curX += (track.targetX - track.curX) * lerpFactor;
              track.curY += (track.targetY - track.curY) * lerpFactor;
              track.curW += (track.targetW - track.curW) * lerpFactor;
              track.curH += (track.targetH - track.curH) * lerpFactor;

              const px = track.curX * canvas.width;
              const py = track.curY * canvas.height;
              const pw = track.curW * canvas.width;
              const ph = track.curH * canvas.height;

              // 1. Red Bounding Box (matching DeepStream OSD bbox-border-color0=1;0;0;1)
              ctx.strokeStyle = '#e53e3e';
              ctx.lineWidth = 2;
              ctx.shadowBlur = 0;
              ctx.strokeRect(px, py, pw, ph);

              // 2. Translucent red overlay fill (matching DeepStream display-mask)
              ctx.fillStyle = 'rgba(229, 62, 62, 0.28)';
              ctx.fillRect(px, py, pw, ph);

              // 3. "person <id>" Label Tag (matching DeepStream OSD font=Serif, text-bg-color=0.3;0.3;0.3;1)
              const label = `person ${track.id}`;
              ctx.font = '14px Serif, "Times New Roman", Georgia, serif';
              const textMetrics = ctx.measureText(label);
              const tagW = textMetrics.width + 10;
              const tagH = 20;
              const tagY = Math.max(0, py - tagH);

              // Dark grey background for label badge (#4d4d4d / rgb(77, 77, 77))
              ctx.fillStyle = 'rgba(70, 70, 70, 0.9)';
              ctx.fillRect(px, tagY, tagW, tagH);

              // White label text
              ctx.fillStyle = '#ffffff';
              ctx.fillText(label, px + 5, tagY + 14);
            });
          }
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [cam.id, metadataMap]);

  return (
    <div
      className="video-card-fms"
      style={{
        display: isVisible ? 'flex' : 'none',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        background: '#0f172a',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        ...(activeTab !== 'all' ? { width: '100%', maxWidth: '1200px', margin: '0 auto' } : {})
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#1e293b', borderBottom: '1px solid #334155', color: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></span>
          <span style={{ fontWeight: 600, fontSize: '15px' }}>{cam.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
            WHEP WebRTC
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>&lt; 25ms</span>
        </div>
      </div>

      <div className="video-frame" ref={containerRef} style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#090d16', overflow: 'hidden' }}>
        {useIframeFallback ? (
          <iframe
            src={`http://${hostName}:8081/${cam.id}/?controls=0&autoplay=1&muted=1&playsinline=1`}
            style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', top: 0, left: 0 }}
            title={cam.name}
            scrolling="no"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              position: 'absolute',
              top: 0,
              left: 0,
              background: '#090d16'
            }}
          />
        )}

        {/* Loading Spinner Indicator if waiting for initial stream keyframe */}
        {!isPlaying && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(9, 13, 22, 0.75)', zIndex: 5, gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', border: '3px solid #334155', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Đang kết nối luồng camera...</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}
        />
      </div>
    </div>
  );
}

export default function MonitorView() {
  const { cameras } = useCameras();
  const [activeTab, setActiveTab] = useState('all');
  const [hostName, setHostName] = useState('localhost');
  const [totalDetections, setTotalDetections] = useState(0);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);
  const [globalTrackList, setGlobalTrackList] = useState<{ id: number; fx: number; fy: number; cam: string }[]>([]);
  const { t } = useLanguage();

  const metadataMap = useRef<Map<string, Map<number, InterpolatedTrack>>>(new Map());

  // WebSockets for Metadata & Events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost';
      setHostName(host);

      let wsMeta: WebSocket | null = null;
      let wsEvents: WebSocket | null = null;

      const connectMeta = () => {
        wsMeta = new WebSocket(`ws://${host}:8000/ws/metadata`);
        wsMeta.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.streams && Array.isArray(data.streams)) {
              let count = 0;
              const now = Date.now();
              const activeGlobals: { id: number; fx: number; fy: number; cam: string }[] = [];

              data.streams.forEach((stream: { cam_id: string; objects: TrackedObject[] }) => {
                const camId = stream.cam_id;
                if (!metadataMap.current.has(camId)) {
                  metadataMap.current.set(camId, new Map());
                }
                const tracks = metadataMap.current.get(camId)!;

                stream.objects.forEach(obj => {
                  count++;
                  const fx = obj.floor_x ?? (obj.x + obj.w / 2);
                  const fy = obj.floor_y ?? (obj.y + obj.h);
                  activeGlobals.push({ id: obj.id, fx, fy, cam: camId });

                  if (!tracks.has(obj.id)) {
                    tracks.set(obj.id, {
                      id: obj.id,
                      curX: obj.x,
                      curY: obj.y,
                      curW: obj.w,
                      curH: obj.h,
                      targetX: obj.x,
                      targetY: obj.y,
                      targetW: obj.w,
                      targetH: obj.h,
                      floorX: fx,
                      floorY: fy,
                      lastUpdated: now
                    });
                  } else {
                    const track = tracks.get(obj.id)!;
                    track.targetX = obj.x;
                    track.targetY = obj.y;
                    track.targetW = obj.w;
                    track.targetH = obj.h;
                    track.floorX = fx;
                    track.floorY = fy;
                    track.lastUpdated = now;
                  }
                });
              });

              setTotalDetections(count);
              setGlobalTrackList(activeGlobals);
            }
          } catch (e) {}
        };
        wsMeta.onclose = () => setTimeout(connectMeta, 2500);
      };

      const connectEvents = () => {
        wsEvents = new WebSocket(`ws://${host}:8000/ws/events`);
        wsEvents.onmessage = (event) => {
          try {
            const ev = JSON.parse(event.data);
            setLiveAlerts(prev => [ev, ...prev.slice(0, 19)]);
          } catch (e) {}
        };
        wsEvents.onclose = () => setTimeout(connectEvents, 2500);
      };

      connectMeta();
      connectEvents();

      return () => {
        if (wsMeta) wsMeta.close();
        if (wsEvents) wsEvents.close();
      };
    }
  }, []);

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 84px)', display: 'flex', flexDirection: 'column' }}>
      {/* Sub Header Navigation */}
      <div className="sub-header" style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sub-tabs" style={{ display: 'flex', gap: '8px' }}>
          <button className={`sub-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            {t.monitor.allCamera} ({cameras.length})
          </button>
          {cameras.map(cam => (
            <button key={cam.id} className={`sub-tab ${activeTab === cam.id ? 'active' : ''}`} onClick={() => setActiveTab(cam.id)}>
              {cam.name}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '6px 14px', borderRadius: '20px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }}></span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#047857' }}>MTMC Fusion Active</span>
          </div>
        </div>
      </div>

      {/* Main Multi-Camera Grid & Floor Plan Area */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', gap: '24px', overflow: 'hidden' }}>
        {cameras.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <p style={{ fontSize: '20px', fontWeight: 600 }}>{t.monitor.noCamera}</p>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px' }}>Chuyển sang tab <b>Building</b> để thêm Camera RTSP và thiết lập Calibration</p>
          </div>
        ) : (
          <>
            {/* Left: Video Streams Grid */}
            <div style={{ flex: 3, overflowY: 'auto', paddingRight: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'all' ? 'repeat(auto-fit, minmax(420px, 1fr))' : '1fr', gap: '20px' }}>
                {cameras.map(cam => (
                  <CameraStreamCard
                    key={cam.id}
                    cam={cam}
                    hostName={hostName}
                    isVisible={activeTab === 'all' || activeTab === cam.id}
                    activeTab={activeTab}
                    metadataMap={metadataMap}
                  />
                ))}
              </div>
            </div>

            {/* Right: Floor Plan 2D Mini-Map & Live Telemetry Panel */}
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: '340px' }}>
              
              {/* 1. Spatial Floor Map (2D MTMC View) */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                    <Layers size={18} color="#3b82f6" /> 2D Floor Plan Tracker
                  </div>
                  <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    Homography 2D
                  </span>
                </div>
                
                {/* 2D Canvas Floor Representation */}
                <div style={{ position: 'relative', width: '100%', height: '220px', background: '#0f172a', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
                  {/* Grid Lines */}
                  <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.2 }}>
                    <defs>
                      <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#94a3b8" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>

                  {/* Camera Field of View Markers */}
                  {cameras.map((c, idx) => (
                    <div key={c.id} style={{ position: 'absolute', top: `${20 + idx * 25}%`, left: `${15 + idx * 25}%`, fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Radio size={12} color="#3b82f6" /> {c.name.slice(0, 10)}
                    </div>
                  ))}

                  {/* Real-time Global Target Dots */}
                  {globalTrackList.map(t => (
                    <div
                      key={t.id}
                      style={{
                        position: 'absolute',
                        left: `${t.fx * 100}%`,
                        top: `${t.fy * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        transition: 'all 0.15s ease-out'
                      }}
                    >
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', border: '2px solid #ffffff', boxShadow: '0 0 10px #ef4444' }}></span>
                      <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#ffffff', background: 'rgba(15,23,42,0.85)', padding: '1px 4px', borderRadius: '3px', marginTop: '2px' }}>
                        #{t.id}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Live Behavior Alerts Feed */}
              <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                    <ShieldAlert size={18} color="#ef4444" /> Live Behavior Alarms
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>PostgreSQL Sync</span>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px' }}>
                  {liveAlerts.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Chưa phát hiện sự kiện bất thường
                    </div>
                  ) : (
                    liveAlerts.map((ev, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: ev.rule_type === 'intrusion' ? '#fef2f2' : ev.rule_type === 'tripwire' ? '#f0fdf4' : '#fffbeb',
                          border: `1px solid ${ev.rule_type === 'intrusion' ? '#fecaca' : ev.rule_type === 'tripwire' ? '#bbf7d0' : '#fde68a'}`,
                          fontSize: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '2px', color: '#1e293b' }}>
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', color: ev.rule_type === 'intrusion' ? '#dc2626' : ev.rule_type === 'tripwire' ? '#16a34a' : '#d97706' }}>
                            {ev.rule_type}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '10px' }}>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p style={{ margin: 0, color: '#334155' }}>{ev.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
