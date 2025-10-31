import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
`;

const Card = styled.div`
  background: white;
  border-radius: 16px;
  padding: 48px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  border: 1px solid #e2e8f0;
  max-width: 500px;
  width: 90%;
  
  @media (max-width: 768px) {
    padding: 32px 24px;
    width: 95%;
    border-radius: 12px;
  }
  
  @media (max-width: 480px) {
    padding: 24px 16px;
    width: 100%;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
  }
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: 32px;
`;

const LogoImage = styled.img`
  width: 120px;
  height: 120px;
  margin-bottom: 16px;
  object-fit: contain;
  
  @media (max-width: 768px) {
    width: 100px;
    height: 100px;
  }
  
  @media (max-width: 480px) {
    width: 80px;
    height: 80px;
    margin-bottom: 12px;
  }
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #1a202c;
  margin: 0 0 8px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 28px;
  }
  
  @media (max-width: 480px) {
    font-size: 24px;
  }
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: #718096;
  margin: 0 0 32px 0;
  text-align: center;
  
  @media (max-width: 768px) {
    font-size: 15px;
    margin: 0 0 24px 0;
  }
  
  @media (max-width: 480px) {
    font-size: 14px;
    margin: 0 0 20px 0;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 16px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  
  ${props => props.variant === 'primary' ? `
    background: #667eea;
    color: white;
    
    &:hover {
      background: #5568d3;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
  ` : `
    background: #f7fafc;
    color: #4a5568;
    border: 2px solid #e2e8f0;
    
    &:hover {
      background: #edf2f7;
      border-color: #cbd5e0;
    }
  `}
  
  &:active {
    transform: translateY(0);
  }
  
  @media (max-width: 768px) {
    padding: 14px 20px;
    font-size: 15px;
  }
  
  @media (max-width: 480px) {
    padding: 12px 16px;
    font-size: 14px;
  }
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  margin: 24px 0;
  color: #a0aec0;
  font-size: 14px;
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }
  
  &::before {
    margin-right: 16px;
  }
  
  &::after {
    margin-left: 16px;
  }
`;

const InputGroup = styled.div`
  margin-bottom: 16px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-family: monospace;
  transition: border-color 0.2s;
  box-sizing: border-box;
  
  &:focus {
    outline: none;
    border-color: #667eea;
  }
  
  &::placeholder {
    color: #a0aec0;
  }
  
  @media (max-width: 768px) {
    padding: 10px 14px;
    font-size: 13px;
  }
  
  @media (max-width: 480px) {
    padding: 10px 12px;
    font-size: 12px;
  }
`;

const ErrorMessage = styled.div`
  background: #fed7d7;
  color: #c53030;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
`;

const SuccessMessage = styled.div`
  background: #c6f6d5;
  color: #2f855a;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  margin-top: 16px;
`;

const RecentSessions = styled.div`
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
`;

const RecentSessionsTitle = styled.h3`
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
  margin: 0 0 12px 0;
`;

const SessionItem = styled.button`
  width: 100%;
  padding: 12px 16px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
  
  &:hover {
    background: #edf2f7;
    border-color: #cbd5e0;
  }
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const SessionId = styled.div`
  font-family: monospace;
  font-size: 12px;
  color: #667eea;
  font-weight: 600;
  word-break: break-all;
  
  @media (max-width: 480px) {
    font-size: 11px;
  }
`;

const SessionTime = styled.div`
  font-size: 11px;
  color: #a0aec0;
  margin-top: 4px;
`;

interface SessionSelectorProps {
  onSessionSelected: (sessionId: string) => void;
  apiBaseUrl: string;
}

const SessionSelector: React.FC<SessionSelectorProps> = ({ onSessionSelected, apiBaseUrl }) => {
  const [joinSessionId, setJoinSessionId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Array<{ id: string; timestamp: string }>>([]);

  // Load recent sessions from localStorage on mount
  React.useEffect(() => {
    const recent = localStorage.getItem('recentSessions');
    if (recent) {
      try {
        setRecentSessions(JSON.parse(recent));
      } catch (e) {
        console.error('Failed to parse recent sessions:', e);
      }
    }
  }, []);

  const saveRecentSession = (sessionId: string) => {
    const recent = recentSessions.filter(s => s.id !== sessionId);
    recent.unshift({ id: sessionId, timestamp: new Date().toISOString() });
    const limited = recent.slice(0, 5); // Keep only last 5
    setRecentSessions(limited);
    localStorage.setItem('recentSessions', JSON.stringify(limited));
  };

  const handleCreateSession = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/api/session`);
      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();
      const sessionId = data.sessionId;

      setSuccess(`Session created: ${sessionId.substring(0, 8)}...`);
      saveRecentSession(sessionId);

      // Wait a moment to show success message
      setTimeout(() => {
        onSessionSelected(sessionId);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinSession = async () => {
    setError('');
    setSuccess('');

    if (!joinSessionId.trim()) {
      setError('Please enter a session ID');
      return;
    }

    setIsLoading(true);

    try {
      // Verify session exists
      const response = await fetch(`${apiBaseUrl}/api/session?sessionId=${joinSessionId.trim()}`);
      if (!response.ok) {
        throw new Error('Session not found or invalid');
      }

      const data = await response.json();
      const sessionId = data.sessionId;

      setSuccess(`Joining session: ${sessionId.substring(0, 8)}...`);
      saveRecentSession(sessionId);

      // Wait a moment to show success message
      setTimeout(() => {
        onSessionSelected(sessionId);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecentSessionClick = (sessionId: string) => {
    setJoinSessionId(sessionId);
    setError('');
    setSuccess('');
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Container>
      <Card>
        <Logo>
          <LogoImage src="/logo.webp" alt="MedForce Logo" />
          <Title>MedForce Board</Title>
          <Subtitle>Collaborative medical board for meetings</Subtitle>
        </Logo>

        <ButtonGroup>
          <Button 
            variant="primary" 
            onClick={handleCreateSession}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Creating...' : '✨ Create New Session'}
          </Button>
        </ButtonGroup>

        <Divider>or</Divider>

        <InputGroup>
          <Label htmlFor="sessionId">Join Existing Session</Label>
          <Input
            id="sessionId"
            type="text"
            placeholder="Enter session ID (e.g., meet-abc-defg-hij)"
            value={joinSessionId}
            onChange={(e) => setJoinSessionId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJoinSession();
              }
            }}
          />
        </InputGroup>

        <Button 
          variant="secondary" 
          onClick={handleJoinSession}
          disabled={isLoading || !joinSessionId.trim()}
        >
          {isLoading ? '⏳ Joining...' : '🚪 Join Session'}
        </Button>

        {error && <ErrorMessage>❌ {error}</ErrorMessage>}
        {success && <SuccessMessage>✅ {success}</SuccessMessage>}

        {recentSessions.length > 0 && (
          <RecentSessions>
            <RecentSessionsTitle>📋 Recent Sessions</RecentSessionsTitle>
            {recentSessions.map((session) => (
              <SessionItem
                key={session.id}
                onClick={() => handleRecentSessionClick(session.id)}
              >
                <SessionId>{session.id}</SessionId>
                <SessionTime>{formatTimestamp(session.timestamp)}</SessionTime>
              </SessionItem>
            ))}
          </RecentSessions>
        )}
      </Card>
    </Container>
  );
};

export default SessionSelector;
