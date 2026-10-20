import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, UserRound, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

export function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await authService.login(username, password, true);
      onLoginSuccess?.(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    // Smooth 3D tilt tracking cursor (-6 to +6 deg)
    const tiltY = (px - 0.5) * 8;
    const tiltX = (0.5 - py) * 8;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EDF3FA',
        fontFamily: "'Plus Jakarta Sans', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      {/* Ambient background blur lighting */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: isHovered
            ? `translate(-50%, -50%) scale(1.08)`
            : 'translate(-50%, -50%) scale(1)',
          width: '850px',
          height: '560px',
          background: 'radial-gradient(circle, rgba(0, 102, 255, 0.16) 0%, rgba(219, 234, 254, 0.45) 60%, transparent 80%)',
          filter: 'blur(80px)',
          transition: 'transform 0.4s ease',
          pointerEvents: 'none'
        }}
      />

      {/* Main Floating 2-Column Card with Cursor-triggered Levitating Float & 3D Tilt */}
      <div
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={isHovered ? 'animate-card-floating' : ''}
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '880px',
          minHeight: '480px',
          borderRadius: '28px',
          transition: isHovered
            ? 'none'
            : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.5s ease',
          transform: isHovered
            ? undefined
            : 'perspective(1200px) translateY(0px)',
          boxShadow: isHovered
            ? undefined
            : '0 25px 60px -15px rgba(0, 80, 220, 0.14), 0 0 1px rgba(0, 0, 0, 0.08)'
        }}
      >
        <main
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '480px',
            backgroundColor: '#FFFFFF',
            borderRadius: '28px',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            overflow: 'hidden',
            transform: isHovered
              ? `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`
              : 'perspective(1200px) rotateX(0deg) rotateY(0deg)',
            transition: 'transform 0.1s ease-out',
            willChange: 'transform'
          }}
        >
        {/* Left Side: Brand Visual with Fluid Blue Waves */}
        <section
          style={{
            flex: '1 1 380px',
            position: 'relative',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #F5F9FE 55%, #E3EFFF 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 32px',
            overflow: 'hidden',
            minHeight: '340px'
          }}
        >
          {/* Smooth layered wave graphics matching screenshot */}
          <svg
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1
            }}
            viewBox="0 0 500 500"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="waveBack" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0066FF" stopOpacity="0.22" />
                <stop offset="70%" stopColor="#93C5FD" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="waveMid" x1="0%" y1="100%" x2="70%" y2="20%">
                <stop offset="0%" stopColor="#0066FF" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#60A5FA" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#EFF6FF" stopOpacity="0.05" />
              </linearGradient>
              <linearGradient id="waveDeep" x1="0%" y1="100%" x2="50%" y2="30%">
                <stop offset="0%" stopColor="#0055EE" stopOpacity="0.75" />
                <stop offset="50%" stopColor="#0066FF" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#93C5FD" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="waveFront" x1="0%" y1="100%" x2="40%" y2="50%">
                <stop offset="0%" stopColor="#0066FF" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* Wave 1: Soft Light Top */}
            <path
              d="M 0,500 L 0,220 C 70,200 140,290 250,250 C 350,210 420,130 500,100 L 500,500 Z"
              fill="url(#waveBack)"
            />
            {/* Wave 2: Medium Azure */}
            <path
              d="M 0,500 L 0,300 C 90,280 160,370 270,320 C 370,270 430,220 500,190 L 500,500 Z"
              fill="url(#waveMid)"
            />
            {/* Wave 3: Deep Blue Flow */}
            <path
              d="M 0,500 L 0,370 C 80,350 160,430 270,380 C 360,330 420,290 500,280 L 500,500 Z"
              fill="url(#waveDeep)"
            />
            {/* Wave 4: Bottom Vibrant Accent */}
            <path
              d="M 0,500 L 0,430 C 70,410 140,470 230,440 C 320,410 410,390 500,360 L 500,500 Z"
              fill="url(#waveFront)"
            />
          </svg>

          {/* Centered Brand Mark */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            {/* Make System Official Brand Logo */}
            <div
              className="animate-logo-float"
              style={{
                width: '86px',
                height: '86px',
                borderRadius: '22px',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px',
                marginBottom: '18px',
                boxShadow: '0 14px 32px -6px rgba(0, 102, 255, 0.22), 0 4px 12px rgba(15, 23, 42, 0.04)',
                border: '2px solid rgba(255, 255, 255, 0.95)'
              }}
            >
              <img
                src="/logo.png"
                alt="Make System Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>

            {/* Heading */}
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 800,
                color: '#0A1A32',
                margin: '0 0 6px 0',
                letterSpacing: '-0.5px'
              }}
            >
              Make <span style={{ color: '#0066FF' }}>System</span>
            </h1>

            {/* Subtitle with spaced uppercase */}
            <p
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.26em',
                color: '#76879E',
                margin: 0,
                textTransform: 'uppercase'
              }}
            >
              PLAN &bull; BUILD &bull; TRACK &bull; GROW
            </p>
          </div>
        </section>

        {/* Right Side: Clean Sign In Form */}
        <section
          style={{
            flex: '1 1 380px',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '48px 48px',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ width: '100%', maxWidth: '340px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '28px' }}>
              <h2
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#0A1A32',
                  margin: '0 0 6px 0',
                  letterSpacing: '-0.5px'
                }}
              >
                Sign In
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: '#76879E',
                  margin: 0
                }}
              >
                Login to continue to Make System
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                style={{
                  marginBottom: '18px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Form Fields */}
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Username Field */}
              <div style={{ position: 'relative', width: '100%' }}>
                <UserRound
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '18px',
                    height: '18px',
                    color: '#8C9BAE',
                    pointerEvents: 'none'
                  }}
                  strokeWidth={1.75}
                />
                <input
                  id="loginUser"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px 16px 13px 44px',
                    border: '1px solid #DCE4EE',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: '#0A1A32',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0066FF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.14)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#DCE4EE';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password Field */}
              <div style={{ position: 'relative', width: '100%' }}>
                <LockKeyhole
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '18px',
                    height: '18px',
                    color: '#8C9BAE',
                    pointerEvents: 'none'
                  }}
                  strokeWidth={1.75}
                />
                <input
                  id="loginPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '13px 16px 13px 44px',
                    border: '1px solid #DCE4EE',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: '#0A1A32',
                    backgroundColor: '#FFFFFF',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#0066FF';
                    e.target.style.boxShadow = '0 0 0 3px rgba(0, 102, 255, 0.14)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#DCE4EE';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '13px 20px',
                  backgroundColor: '#0066FF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: isLoading ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 102, 255, 0.28)',
                  transition: 'background-color 0.15s, transform 0.15s, box-shadow 0.15s',
                  opacity: isLoading ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#0052CC';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(0, 102, 255, 0.38)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0066FF';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 102, 255, 0.28)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Login</span>
                    <ArrowRight style={{ width: 17, height: 17 }} strokeWidth={2.2} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
      </div>
    </div>
  );
}
